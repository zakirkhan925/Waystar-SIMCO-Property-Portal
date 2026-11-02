-- Phase 3 (access + reporting).
-- Same contract as Phase 2: these tables are READ-ONLY through the API. Possession,
-- transfers, cancellations and refunds all happen through the Phase 3 functions, which
-- check the caller themselves.

alter table public.possessions   enable row level security;
alter table public.transfers     enable row level security;
alter table public.cancellations enable row level security;

revoke all on public.possessions, public.transfers, public.cancellations from anon;

-- Whoever can see the sale can see its possession and transfer history. That includes the
-- buyer (Phase 6 client portal), which is the point: these are their documents.
create policy possessions_select on public.possessions for select to authenticated
  using (deleted_at is null and (select private.can_see_sale(sale_id)));

create policy transfers_select on public.transfers for select to authenticated
  using ((select private.can_see_sale(sale_id)));

-- A cancellation carries the refund arithmetic, so it is staff-only: an agent has no
-- business seeing what was deducted from someone else's booking.
create policy cancellations_select on public.cancellations for select to authenticated
  using ((select private.can_access_project(project_id))
         and (select private.has_role('super_admin','manager','accounts','viewer')));

do $$
declare t text;
begin
  foreach t in array array['possessions','transfers','cancellations']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
end $$;

create trigger possessions_guard_delete before update of deleted_at on public.possessions
  for each row execute function private.guard_soft_delete();

-- ---------------------------------------------------------------------------
-- Refunds owed. "payable" means the plot has been re-sold and the clock has started;
-- days_overdue counts past refund_due_date so Accounts can see what is late.
-- ---------------------------------------------------------------------------
create view public.v_refunds_due with (security_invoker = true) as
select
  c.id as cancellation_id, c.project_id, p.name as project_name, p.code as project_code,
  c.unit_id, u.unit_no, c.sale_id, c.cancellation_no, c.cancelled_on, c.reason,
  c.amount_received, c.sale_price, c.deduction_pct, c.deduction_amount, c.refund_due,
  c.refund_status, c.resold_sale_id, c.refund_due_date, c.refunded_on, c.refund_reference,
  case
    when c.refund_status <> 'payable' or c.refund_due_date is null then null
    else (private.today_pk() - c.refund_due_date)
  end as days_overdue,
  cl.id as client_id, cl.full_name as client_name, cl.phone as client_phone,
  cl.whatsapp as client_whatsapp
from public.cancellations c
join public.projects p on p.id = c.project_id
join public.units u on u.id = c.unit_id
-- the largest original (non-transfer) owner is who the money goes back to
left join public.unit_ownerships o
  on o.sale_id = c.sale_id and o.acquired_via <> 'transfer' and o.share_pct = (
       select max(o2.share_pct) from public.unit_ownerships o2 where o2.sale_id = c.sale_id)
left join public.clients cl on cl.id = o.client_id;

grant select on public.v_refunds_due to authenticated;
revoke all on public.v_refunds_due from anon;
