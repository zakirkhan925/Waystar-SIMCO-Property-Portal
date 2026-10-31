-- Fix: a penalty must reflect WHEN the money actually arrived, not when someone typed it in.
--
-- The first version computed the penalty as of today against the installment's due date, and
-- then froze it so it could not shrink. Entering a back-dated booking charged a penalty before
-- its historical payments had been entered, and the freeze made that bogus penalty permanent —
-- a down payment paid on its due date showed 17 months of penalty.
--
-- Now the penalty is a historical fact:
--   * it is charged on the amount still outstanding AT the due date (money paid on time is
--     never penalised), and
--   * it runs from the due date until the installment was settled, or until today if it is
--     still outstanding.
-- Because both ends are facts, the fee stops growing once settled without needing to be frozen,
-- and correcting a receipt corrects the penalty with it.

create or replace function private.accrued_late_fee(
  p_due date, p_until date, p_base numeric, p_amount_due numeric,
  p_method public.late_fee_method, p_rate numeric, p_grace smallint, p_cap_pct numeric)
returns numeric
language plpgsql immutable set search_path = '' as $$
declare
  v_from date; v_months int; v_fee numeric(14,2); v_age interval;
begin
  if p_method = 'none' or p_due is null or p_base <= 0 or p_rate <= 0 or p_until is null then
    return 0;
  end if;
  v_from := p_due + coalesce(p_grace, 0);
  if p_until <= v_from then
    return 0;                       -- settled within the due date (and any grace days)
  end if;

  v_age := age(p_until, v_from);
  -- a started month counts as a whole one (the client's rule, 30-Oct-2026)
  v_months := (extract(year from v_age) * 12 + extract(month from v_age))::int
              + case when extract(day from v_age) > 0 then 1 else 0 end;

  v_fee := case p_method
             when 'flat_per_installment'      then p_rate * v_months
             when 'pct_of_overdue_per_month'  then p_base * p_rate / 100 * v_months
             when 'pct_per_day'               then p_base * p_rate / 100 * (p_until - v_from)
           end;

  if p_cap_pct is not null then
    v_fee := least(v_fee, p_amount_due * p_cap_pct / 100);
  end if;
  return round(greatest(v_fee, 0), 2);
end $$;

create or replace function private.recompute_installment(p_installment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_paid numeric(14,2); v_pending numeric(14,2); v_fee_paid numeric(14,2);
  v_paid_on_time numeric(14,2); v_settled_on date; v_base numeric(14,2);
  v_i public.installments; v_p public.projects;
  v_fee numeric(14,2); v_today date := private.today_pk(); v_grace smallint;
begin
  select i.* into v_i from public.installments i where i.id = p_installment;
  if v_i.id is null then return; end if;

  select p.* into v_p from public.projects p
  join public.sales s on s.project_id = p.id where s.id = v_i.sale_id;
  v_grace := coalesce(v_p.late_fee_grace_days, 0);

  select coalesce(sum(a.amount) filter (
           where a.component = 'principal' and private.payment_is_cleared(p.status, p.instrument_status)), 0),
         coalesce(sum(a.amount) filter (
           where a.component = 'principal' and p.status = 'valid' and p.instrument_status = 'pending'), 0),
         coalesce(sum(a.amount) filter (
           where a.component = 'late_fee' and private.payment_is_cleared(p.status, p.instrument_status)), 0),
         -- principal that arrived on or before the deadline is never penalised
         coalesce(sum(a.amount) filter (
           where a.component = 'principal' and private.payment_is_cleared(p.status, p.instrument_status)
             and v_i.due_date is not null and p.received_on <= v_i.due_date + v_grace), 0),
         -- the day the last of the principal arrived
         max(p.received_on) filter (
           where a.component = 'principal' and private.payment_is_cleared(p.status, p.instrument_status))
    into v_paid, v_pending, v_fee_paid, v_paid_on_time, v_settled_on
  from public.payment_allocations a
  join public.payments p on p.id = a.payment_id
  where a.installment_id = p_installment;

  v_base := v_i.amount_due - v_i.waived_amount - v_paid_on_time;
  v_fee := private.accrued_late_fee(
    v_i.due_date,
    -- run the clock to the day it was settled, or to today while it is still owing
    case when v_paid + v_i.waived_amount >= v_i.amount_due then v_settled_on else v_today end,
    v_base, v_i.amount_due,
    v_p.late_fee_method, v_p.late_fee_rate, v_grace, v_p.late_fee_cap_pct);

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

-- recompute every installment now that the rule has changed
do $$
declare r record;
begin
  for r in select id from public.installments where deleted_at is null loop
    perform private.recompute_installment(r.id);
  end loop;
end $$;

grant execute on all functions in schema private to authenticated, service_role;
