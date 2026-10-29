-- Phase 2 (access + reporting). Sales, installments, payments and allocations are READ-ONLY
-- through the API: every write goes through the Phase 2 functions, which check the caller.

alter table public.payment_plans       enable row level security;
alter table public.sales               enable row level security;
alter table public.sale_buyers         enable row level security;
alter table public.unit_ownerships     enable row level security;
alter table public.installments        enable row level security;
alter table public.doc_sequences       enable row level security;
alter table public.payments            enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.commissions         enable row level security;
alter table public.commission_receipts enable row level security;

revoke all on public.payment_plans, public.sales, public.sale_buyers, public.unit_ownerships,
              public.installments, public.doc_sequences, public.payments, public.payment_allocations,
              public.commissions, public.commission_receipts from anon;

-- Can the current user see this sale? Agents see their own; a client (Phase 6) sees theirs.
create or replace function private.can_see_sale(p_sale uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sales s
    where s.id = p_sale
      and private.can_access_project(s.project_id)
      and (
        private.has_role('super_admin','manager','accounts','viewer')
        or (private.has_role('sales_agent') and s.agent_id = auth.uid())
        or exists (select 1 from public.sale_buyers b
                   where b.sale_id = s.id and b.client_id = private.my_client_id())
      ))
$$;

-- payment_plans -------------------------------------------------------------
create policy payment_plans_select on public.payment_plans for select to authenticated
  using ((select private.is_staff()) and deleted_at is null
         and (project_id is null or (select private.can_access_project(project_id))));
create policy payment_plans_insert on public.payment_plans for insert to authenticated
  with check ((select private.has_role('super_admin','manager')));
create policy payment_plans_update on public.payment_plans for update to authenticated
  using ((select private.has_role('super_admin','manager')))
  with check ((select private.has_role('super_admin','manager')));

-- sales ---------------------------------------------------------------------
create policy sales_select on public.sales for select to authenticated
  using (deleted_at is null and (select private.can_see_sale(id)));
-- notes, status and the cancellation flag are the only editable fields, and only for Managers
create policy sales_update on public.sales for update to authenticated
  using ((select private.has_role('super_admin','manager')) and (select private.can_access_project(project_id)))
  with check ((select private.has_role('super_admin','manager')) and (select private.can_access_project(project_id)));

create policy sale_buyers_select on public.sale_buyers for select to authenticated
  using ((select private.can_see_sale(sale_id)));

create policy unit_ownerships_select on public.unit_ownerships for select to authenticated
  using (exists (select 1 from public.units u
                 where u.id = unit_ownerships.unit_id and (select private.can_access_project(u.project_id))));

create policy installments_select on public.installments for select to authenticated
  using (deleted_at is null and (select private.can_see_sale(sale_id)));

create policy payments_select on public.payments for select to authenticated
  using ((select private.can_see_sale(sale_id)));

create policy payment_allocations_select on public.payment_allocations for select to authenticated
  using (exists (select 1 from public.payments p
                 where p.id = payment_allocations.payment_id and (select private.can_see_sale(p.sale_id))));

create policy commissions_select on public.commissions for select to authenticated
  using ((select private.can_access_project(project_id))
         and ((select private.has_role('super_admin','manager','accounts','viewer'))
              or agent_id = (select auth.uid())));
create policy commission_receipts_select on public.commission_receipts for select to authenticated
  using (exists (select 1 from public.commissions c
                 where c.id = commission_receipts.commission_id
                   and (select private.has_role('super_admin','manager','accounts'))
                   and (select private.can_access_project(c.project_id))));

-- doc_sequences is internal: readable by Super Admins only, never written through the API
create policy doc_sequences_select on public.doc_sequences for select to authenticated
  using ((select private.has_role('super_admin')));

-- audit every money table
do $$
declare t text;
begin
  foreach t in array array['payment_plans','sales','sale_buyers','unit_ownerships','installments',
                           'payments','payment_allocations','commissions','commission_receipts']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
end $$;

-- soft delete stays a Super Admin action
do $$
declare t text;
begin
  foreach t in array array['payment_plans','sales','installments']
  loop
    execute format('create trigger %I before update of deleted_at on public.%I
                    for each row execute function private.guard_soft_delete()', t || '_guard_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Reporting views (security_invoker: each caller sees only their own rows)
-- ---------------------------------------------------------------------------

/** Running statement for one sale: priced, paid, pending, outstanding, overdue, next due. */
create view public.v_sale_ledger with (security_invoker = true) as
select
  s.id                                                           as sale_id,
  s.project_id,
  s.unit_id,
  s.final_price,
  coalesce(sum(i.amount_paid), 0)::numeric(14,2)                 as total_paid,
  coalesce(sum(i.amount_pending), 0)::numeric(14,2)              as total_pending,
  coalesce(sum(i.waived_amount), 0)::numeric(14,2)               as total_waived,
  coalesce(sum(i.late_fee), 0)::numeric(14,2)                    as total_late_fee,
  (s.final_price + coalesce(sum(i.late_fee), 0)
     - coalesce(sum(i.amount_paid + i.waived_amount), 0))::numeric(14,2)  as balance,
  coalesce(sum(i.amount_due + i.late_fee - i.amount_paid - i.waived_amount)
           filter (where i.status = 'overdue'), 0)::numeric(14,2) as overdue_amount,
  max(i.days_overdue) filter (where i.status = 'overdue')        as max_days_overdue,
  min(i.due_date) filter (where i.status in ('pending','partially_paid','overdue')) as next_due_date,
  case when s.final_price > 0
       then round(100 * coalesce(sum(i.amount_paid), 0) / s.final_price, 2)
       else 0 end::numeric(5,2)                                  as pct_paid
from public.sales s
left join public.installments i on i.sale_id = s.id and i.deleted_at is null
where s.deleted_at is null
group by s.id;

/** Money owed right now, in the usual aging buckets. */
create view public.v_receivables with (security_invoker = true) as
select
  i.id as installment_id, i.sale_id, s.project_id, s.unit_id, u.unit_no, i.seq, i.label, i.type,
  i.due_date, i.days_overdue, i.status,
  (i.amount_due + i.late_fee - i.amount_paid - i.waived_amount)::numeric(14,2) as outstanding,
  i.amount_pending,
  case
    when i.days_overdue = 0  then 'not_due'
    when i.days_overdue <= 30 then '0_30'
    when i.days_overdue <= 60 then '31_60'
    when i.days_overdue <= 90 then '61_90'
    else '90_plus'
  end as aging_bucket,
  c.id as client_id, c.full_name as client_name, c.phone as client_phone, c.whatsapp as client_whatsapp
from public.installments i
join public.sales s on s.id = i.sale_id and s.deleted_at is null
join public.units u on u.id = s.unit_id
left join public.sale_buyers b on b.sale_id = s.id and b.is_primary
left join public.clients c on c.id = b.client_id
where i.deleted_at is null
  and i.status in ('pending','partially_paid','overdue')
  and s.status in ('booked','active');

/** One row per sale for lists and the dashboard. */
create view public.v_sale_summary with (security_invoker = true) as
select
  s.id as sale_id, s.project_id, s.unit_id, s.booking_form_no, s.booking_date, s.status, s.plan_kind,
  s.final_price, s.discount, s.cancellation_due, s.agent_id,
  p.name as project_name, p.code as project_code,
  u.unit_no, u.category, bl.name as block_name, u.street, fl.label as floor_label,
  c.id as primary_client_id, c.full_name as primary_client_name, c.cnic as primary_client_cnic,
  c.phone as primary_client_phone,
  (select count(*) from public.sale_buyers sb where sb.sale_id = s.id) as buyer_count,
  l.total_paid, l.balance, l.overdue_amount, l.next_due_date, l.pct_paid,
  pr.full_name as agent_name
from public.sales s
join public.projects p on p.id = s.project_id
join public.units u on u.id = s.unit_id
left join public.blocks bl on bl.id = u.block_id
left join public.floors fl on fl.id = u.floor_id
left join public.sale_buyers b on b.sale_id = s.id and b.is_primary
left join public.clients c on c.id = b.client_id
left join public.v_sale_ledger l on l.sale_id = s.id
left join public.profiles pr on pr.id = s.agent_id
where s.deleted_at is null;

grant select on public.v_sale_ledger, public.v_receivables, public.v_sale_summary to authenticated;
revoke all on public.v_sale_ledger, public.v_receivables, public.v_sale_summary from anon;
