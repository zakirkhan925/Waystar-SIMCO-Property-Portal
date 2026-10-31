-- Client decisions of 30-Oct-2026 (docs/02-business-rules.md):
--   * the balance of the down payment is due immediately ("ASAP") → 0 days for Simco Villas
--   * the 10% penalty is charged PER STARTED MONTH, not pro-rata per day
--   * a payment settles the INSTALLMENT first, and only then the penalty on it
--   * the full-payment discount is 5%
--
-- Because the penalty is settled last, paid and owing have to be tracked separately for the
-- installment itself and for its penalty — hence late_fee_paid and the allocation component.

alter table public.projects
  add column full_payment_discount_pct numeric(5,2) check (full_payment_discount_pct between 0 and 100);

comment on column public.projects.full_payment_discount_pct is
  'Discount for paying in full. SIMCO applies it AFTER adding the possession charge.';

alter table public.installments
  add column late_fee_paid numeric(14,2) not null default 0 check (late_fee_paid >= 0);

-- An allocation now says which part of the installment it settles.
alter table public.payment_allocations
  add column component text not null default 'principal' check (component in ('principal', 'late_fee'));

alter table public.payment_allocations drop constraint payment_allocations_payment_id_installment_id_key;
alter table public.payment_allocations
  add constraint payment_allocations_unique unique (payment_id, installment_id, component);

-- ---------------------------------------------------------------------------
-- Penalty: rate x outstanding installment x months started, after any grace days.
-- It is ACCRUED, never recalculated downwards: once a month has started the penalty for it
-- is owed, so paying the installment later stops the penalty growing but does not erase it.
-- ---------------------------------------------------------------------------
create or replace function private.accrued_late_fee(
  p_due date, p_outstanding numeric, p_amount_due numeric,
  p_method public.late_fee_method, p_rate numeric, p_grace smallint, p_cap_pct numeric)
returns numeric
language plpgsql immutable set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  v_from date; v_months int; v_fee numeric(14,2); v_age interval;
begin
  if p_method = 'none' or p_due is null or p_outstanding <= 0 or p_rate <= 0 then
    return 0;
  end if;
  v_from := p_due + coalesce(p_grace, 0);
  if v_today <= v_from then
    return 0;
  end if;

  v_age := age(v_today, v_from);
  -- a started month counts as a whole one
  v_months := (extract(year from v_age) * 12 + extract(month from v_age))::int
              + case when extract(day from v_age) > 0 then 1 else 0 end;

  v_fee := case p_method
             when 'flat_per_installment'      then p_rate * v_months
             when 'pct_of_overdue_per_month'  then p_outstanding * p_rate / 100 * v_months
             when 'pct_per_day'               then p_outstanding * p_rate / 100 * (v_today - v_from)
           end;

  if p_cap_pct is not null then
    v_fee := least(v_fee, p_amount_due * p_cap_pct / 100);
  end if;
  return round(greatest(v_fee, 0), 2);
end $$;

-- ---------------------------------------------------------------------------
-- Recompute an installment: what has been paid against it, what penalty it carries,
-- and where that leaves it.
-- ---------------------------------------------------------------------------
create or replace function private.recompute_installment(p_installment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_paid numeric(14,2); v_pending numeric(14,2); v_fee_paid numeric(14,2);
  v_i public.installments; v_p public.projects;
  v_outstanding numeric(14,2); v_fee numeric(14,2); v_today date := private.today_pk();
begin
  select i.* into v_i from public.installments i where i.id = p_installment;
  if v_i.id is null then return; end if;

  select p.* into v_p from public.projects p
  join public.sales s on s.project_id = p.id where s.id = v_i.sale_id;

  select coalesce(sum(a.amount) filter (
           where a.component = 'principal' and private.payment_is_cleared(p.status, p.instrument_status)), 0),
         coalesce(sum(a.amount) filter (
           where a.component = 'principal' and p.status = 'valid' and p.instrument_status = 'pending'), 0),
         coalesce(sum(a.amount) filter (
           where a.component = 'late_fee' and private.payment_is_cleared(p.status, p.instrument_status)), 0)
    into v_paid, v_pending, v_fee_paid
  from public.payment_allocations a
  join public.payments p on p.id = a.payment_id
  where a.installment_id = p_installment;

  v_outstanding := v_i.amount_due - v_paid - v_i.waived_amount;
  v_fee := private.accrued_late_fee(v_i.due_date, v_outstanding, v_i.amount_due,
                                    v_p.late_fee_method, v_p.late_fee_rate,
                                    v_p.late_fee_grace_days, v_p.late_fee_cap_pct);
  -- never let an already-incurred penalty shrink
  v_fee := greatest(v_fee, v_i.late_fee);

  update public.installments i set
    amount_paid    = v_paid,
    amount_pending = v_pending,
    late_fee_paid  = v_fee_paid,
    late_fee       = v_fee,
    status = (case
                when i.waived_amount >= i.amount_due then 'waived'
                when v_paid + i.waived_amount >= i.amount_due and v_fee_paid >= v_fee then 'paid'
                when v_paid > 0 or v_fee_paid > 0 then 'partially_paid'
                when i.due_date is not null and i.due_date < v_today then 'overdue'
                else 'pending'
              end)::public.installment_status,
    days_overdue = case
                     when i.due_date is not null and i.due_date < v_today
                          and (v_paid + i.waived_amount < i.amount_due or v_fee_paid < v_fee)
                     then (v_today - i.due_date)
                     else 0
                   end
  where i.id = p_installment;
end $$;

-- ---------------------------------------------------------------------------
-- Allocation: oldest installment first and, within it, the installment before the penalty.
-- ---------------------------------------------------------------------------
create or replace function private.allocate(p_payment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments; v_left numeric(14,2); v_take numeric(14,2); r record;
begin
  select * into v_pay from public.payments where id = p_payment;
  if v_pay.id is null then
    raise exception 'Payment not found' using errcode = '42501';
  end if;

  delete from public.payment_allocations where payment_id = p_payment;

  -- a reversed or bounced payment is not money: it settles nothing
  if v_pay.status <> 'valid' or v_pay.instrument_status = 'bounced' then
    return;
  end if;

  v_left := v_pay.amount;
  for r in
    select i.id,
           (i.amount_due - i.waived_amount - i.amount_paid - i.amount_pending) as principal_left,
           (i.late_fee - i.late_fee_paid) as fee_left
    from public.installments i
    where i.sale_id = v_pay.sale_id and i.deleted_at is null and i.status <> 'waived'
    order by i.due_date nulls last, i.seq
  loop
    exit when v_left <= 0;

    -- the installment itself comes first (SIMCO's rule)
    if r.principal_left > 0 then
      v_take := least(v_left, r.principal_left);
      insert into public.payment_allocations (payment_id, installment_id, component, amount, created_by)
      values (p_payment, r.id, 'principal', v_take, auth.uid());
      v_left := v_left - v_take;
    end if;

    -- then the penalty on it
    if v_left > 0 and r.fee_left > 0 then
      v_take := least(v_left, r.fee_left);
      insert into public.payment_allocations (payment_id, installment_id, component, amount, created_by)
      values (p_payment, r.id, 'late_fee', v_take, auth.uid());
      v_left := v_left - v_take;
    end if;
  end loop;
  -- anything left over stays unallocated: an advance on account, visible in the ledger
end $$;

-- Hand allocation keeps the same two components.
create or replace function public.set_payment_allocations(p_payment uuid, p_alloc jsonb, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments; v_total numeric(14,2); a jsonb;
begin
  select * into v_pay from public.payments where id = p_payment;
  if v_pay.id is null or not private.can_handle_money(v_pay.project_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'A reason is required when allocating a payment by hand';
  end if;
  perform set_config('app.reason', left(trim(p_reason), 500), true);

  select coalesce(sum((value->>'amount')::numeric), 0) into v_total from jsonb_array_elements(p_alloc);
  if v_total > v_pay.amount then
    raise exception 'Allocations (%) add up to more than the payment (%)', v_total, v_pay.amount;
  end if;

  delete from public.payment_allocations where payment_id = p_payment;
  for a in select * from jsonb_array_elements(p_alloc) loop
    if (a->>'amount')::numeric > 0 then
      insert into public.payment_allocations (payment_id, installment_id, component, amount, created_by)
      select p_payment, i.id, coalesce(nullif(a->>'component',''), 'principal'), (a->>'amount')::numeric, auth.uid()
      from public.installments i
      where i.id = (a->>'installment_id')::uuid and i.sale_id = v_pay.sale_id and i.deleted_at is null;
    end if;
  end loop;

  perform private.refresh_sale(v_pay.sale_id);
end $$;

/** Recompute everything derived from one sale, installments included. */
create or replace function private.refresh_sale(p_sale uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_unit uuid; r record;
begin
  select unit_id into v_unit from public.sales where id = p_sale;
  for r in select id from public.installments where sale_id = p_sale and deleted_at is null loop
    perform private.recompute_installment(r.id);
  end loop;
  perform private.refresh_commission(p_sale);
  perform private.refresh_cancellation_flag(p_sale);
  if v_unit is not null then perform private.refresh_unit_status(v_unit); end if;
end $$;

-- ---------------------------------------------------------------------------
-- The standard full-payment discount is policy, not a negotiated one, so it does not
-- need a Manager. Anything beyond it still does.
-- ---------------------------------------------------------------------------
create or replace function public.create_sale(p jsonb)
returns public.sales
language plpgsql security definer set search_path = '' as $$
declare
  v_sale public.sales; v_unit public.units; v_plan public.payment_plans; v_project_row public.projects;
  v_buyer jsonb; v_no text; v_project uuid; v_shares numeric;
  v_discount numeric; v_list numeric; v_allowed_pct numeric;
begin
  select * into v_unit from public.units
  where id = (p->>'unit_id')::uuid and deleted_at is null for update;
  if v_unit.id is null then
    raise exception 'Unit not found' using errcode = '42501';
  end if;
  v_project := v_unit.project_id;
  select * into v_project_row from public.projects where id = v_project;

  if not private.can_book(v_project) then
    raise exception 'You do not have permission to book units in this project' using errcode = '42501';
  end if;
  if v_unit.status in ('booked','sold','rented','blocked') then
    raise exception 'This unit is % and cannot be booked', v_unit.status;
  end if;
  if jsonb_array_length(coalesce(p->'buyers', '[]'::jsonb)) = 0 then
    raise exception 'Add at least one buyer';
  end if;

  if nullif(p->>'payment_plan_id','') is not null then
    select * into v_plan from public.payment_plans
    where id = (p->>'payment_plan_id')::uuid and deleted_at is null and is_active;
    if v_plan.id is null then
      raise exception 'Payment plan not found';
    end if;
  end if;

  v_list := (p->>'list_price')::numeric;
  v_discount := coalesce((p->>'discount')::numeric, 0);
  if v_discount > 0 and not private.has_role('super_admin','manager') then
    -- the standard full-payment discount is allowed; anything above it needs a Manager
    v_allowed_pct := (select discount_approval_threshold_pct from public.company_settings where id);
    if (p->>'plan_kind') = 'full_cash' and v_project_row.full_payment_discount_pct is not null then
      v_allowed_pct := greatest(v_allowed_pct, v_project_row.full_payment_discount_pct);
    end if;
    if v_discount * 100 / nullif(v_list, 0) > v_allowed_pct + 0.01 then
      raise exception 'A discount of this size needs a Manager' using errcode = '42501';
    end if;
  end if;

  v_no := coalesce(nullif(p->>'booking_form_no',''), public.next_doc_no(v_project, 'BF'));

  insert into public.sales (
    unit_id, project_id, booking_form_no, booking_date, list_price, discount, plan_kind, payment_plan_id,
    down_payment_pct, installment_pct, possession_pct, tenure_months, frequency, booking_amount,
    first_installment_date, agent_id, dealer_id, commission_pct, notes, status, created_by)
  values (
    v_unit.id, v_project, v_no, (p->>'booking_date')::date, v_list, v_discount,
    (p->>'plan_kind')::public.plan_kind, v_plan.id,
    coalesce((p->>'down_payment_pct')::numeric, v_plan.down_payment_pct,
             case when (p->>'plan_kind') = 'full_cash' then 100 end),
    coalesce((p->>'installment_pct')::numeric, v_plan.installment_pct,
             case when (p->>'plan_kind') = 'full_cash' then 0 end),
    coalesce((p->>'possession_pct')::numeric, v_plan.possession_pct,
             case when (p->>'plan_kind') = 'full_cash' then 0 end),
    coalesce((p->>'tenure_months')::smallint, v_plan.tenure_months),
    coalesce(nullif(p->>'frequency','')::public.plan_frequency, v_plan.frequency),
    nullif(p->>'booking_amount','')::numeric,
    nullif(p->>'first_installment_date','')::date,
    coalesce(nullif(p->>'agent_id','')::uuid, auth.uid()),
    nullif(p->>'dealer_id','')::uuid,
    coalesce((p->>'commission_pct')::numeric,
             (select default_sale_commission_pct from public.company_settings where id)),
    nullif(p->>'notes',''),
    'booked', auth.uid())
  returning * into v_sale;

  select coalesce(sum((b->>'share_pct')::numeric), 0) into v_shares
  from jsonb_array_elements(p->'buyers') b;
  if v_shares <> 100 then
    raise exception 'Buyer shares must add up to 100%% (they add up to %%%)', v_shares;
  end if;

  for v_buyer in select * from jsonb_array_elements(p->'buyers') loop
    insert into public.sale_buyers (sale_id, client_id, share_pct, is_primary)
    values (v_sale.id, (v_buyer->>'client_id')::uuid, (v_buyer->>'share_pct')::numeric,
            coalesce((v_buyer->>'is_primary')::boolean, false));

    insert into public.unit_ownerships (unit_id, sale_id, client_id, share_pct, valid_from, acquired_via, created_by)
    values (v_unit.id, v_sale.id, (v_buyer->>'client_id')::uuid, (v_buyer->>'share_pct')::numeric,
            v_sale.booking_date, 'booking', auth.uid());
  end loop;

  perform private.build_schedule(v_sale.id);
  perform private.refresh_sale(v_sale.id);

  select * into v_sale from public.sales where id = v_sale.id;
  return v_sale;
end $$;

-- ---------------------------------------------------------------------------
-- Views: the penalty is owed on top of the installment, and settled after it
-- ---------------------------------------------------------------------------
drop view if exists public.v_sale_summary;
drop view if exists public.v_sale_ledger;

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
  coalesce(sum(i.late_fee_paid), 0)::numeric(14,2)               as total_late_fee_paid,
  (s.final_price + coalesce(sum(i.late_fee), 0)
     - coalesce(sum(i.amount_paid + i.waived_amount + i.late_fee_paid), 0))::numeric(14,2) as balance,
  coalesce(sum(i.amount_due + i.late_fee - i.amount_paid - i.waived_amount - i.late_fee_paid)
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

create view public.v_sale_summary with (security_invoker = true) as
select
  s.id as sale_id, s.project_id, s.unit_id, s.booking_form_no, s.booking_date, s.status, s.plan_kind,
  s.final_price, s.discount, s.cancellation_due, s.agent_id,
  p.name as project_name, p.code as project_code,
  u.unit_no, u.category, bl.name as block_name, u.street, fl.label as floor_label,
  c.id as primary_client_id, c.full_name as primary_client_name, c.cnic as primary_client_cnic,
  c.phone as primary_client_phone,
  (select count(*) from public.sale_buyers sb where sb.sale_id = s.id) as buyer_count,
  l.total_paid, l.balance, l.overdue_amount, l.next_due_date, l.pct_paid, l.total_late_fee,
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

drop view if exists public.v_receivables;
create view public.v_receivables with (security_invoker = true) as
select
  i.id as installment_id, i.sale_id, s.project_id, p.name as project_name, p.code as project_code,
  s.unit_id, u.unit_no, i.seq, i.label, i.type,
  i.due_date, i.days_overdue, i.status,
  (i.amount_due - i.amount_paid - i.waived_amount)::numeric(14,2)      as principal_outstanding,
  (i.late_fee - i.late_fee_paid)::numeric(14,2)                        as late_fee_outstanding,
  (i.amount_due + i.late_fee - i.amount_paid - i.waived_amount - i.late_fee_paid)::numeric(14,2) as outstanding,
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
join public.projects p on p.id = s.project_id
join public.units u on u.id = s.unit_id
left join public.sale_buyers b on b.sale_id = s.id and b.is_primary
left join public.clients c on c.id = b.client_id
where i.deleted_at is null
  and i.status in ('pending','partially_paid','overdue')
  and s.status in ('booked','active');

grant select on public.v_sale_ledger, public.v_sale_summary, public.v_receivables to authenticated;
revoke all on public.v_sale_ledger, public.v_sale_summary, public.v_receivables from anon;

-- ---------------------------------------------------------------------------
-- Simco Villas policy, as confirmed by the client
-- ---------------------------------------------------------------------------
update public.projects set
  down_payment_balance_days = 0,       -- the balance of the down payment is due at once
  full_payment_discount_pct = 5
where code = 'SV';

grant execute on all functions in schema private to authenticated, service_role;
