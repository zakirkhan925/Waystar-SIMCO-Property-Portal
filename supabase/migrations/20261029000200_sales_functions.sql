-- Phase 2 (logic): numbering, schedule generation, payment allocation, clearing,
-- reversal, and the derived values (installment totals, unit status, commission).
--
-- All arithmetic happens here in numeric(14,2); the app never computes money it then stores.
--
-- Sales, installments, payments and allocations have NO write policies: the only way in is
-- through the functions below. Each public function is SECURITY DEFINER and checks the caller
-- itself, so the rules live in one place and cannot be sidestepped by a crafted PostgREST call.

-- ---------------------------------------------------------------------------
-- Who may do what in Phase 2
-- ---------------------------------------------------------------------------
create or replace function private.can_book(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('super_admin','manager')
      or (private.has_role('sales_agent') and private.can_access_project(p_project))
$$;

/** Recording money: Accounts, plus Managers and Super Admins. */
create or replace function private.can_handle_money(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('super_admin','manager','accounts') and private.can_access_project(p_project)
$$;

create or replace function private.sale_project(p_sale uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select project_id from public.sales where id = p_sale
$$;

-- ---------------------------------------------------------------------------
-- Gap-free document numbers: SV-RCPT-2026-000123
-- ---------------------------------------------------------------------------
create or replace function public.next_doc_no(p_project uuid, p_doc_type text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text; v_year smallint := extract(year from private.today_pk())::smallint; v_no int;
begin
  if not private.is_staff() then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  select code into v_code from public.projects where id = p_project;
  if v_code is null then
    raise exception 'Unknown project';
  end if;

  insert into public.doc_sequences (project_id, doc_type, year, last_no)
  values (p_project, upper(p_doc_type), v_year, 1)
  on conflict (project_id, doc_type, year)
    do update set last_no = public.doc_sequences.last_no + 1    -- the row lock makes this gap-free
  returning last_no into v_no;

  return format('%s-%s-%s-%s', v_code, upper(p_doc_type), v_year, lpad(v_no::text, 6, '0'));
end $$;
revoke execute on function public.next_doc_no(uuid, text) from anon, public;
grant execute on function public.next_doc_no(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Derived values
-- ---------------------------------------------------------------------------

-- Money is only money once it is valid and its instrument has cleared.
create or replace function private.payment_is_cleared(p_status public.record_status, p_instr public.instrument_status)
returns boolean language sql immutable set search_path = '' as $$
  select p_status = 'valid' and p_instr in ('not_applicable', 'cleared')
$$;

create or replace function private.recompute_installment(p_installment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_paid numeric(14,2); v_pending numeric(14,2); v_today date := private.today_pk();
begin
  select coalesce(sum(a.amount) filter (where private.payment_is_cleared(p.status, p.instrument_status)), 0),
         coalesce(sum(a.amount) filter (where p.status = 'valid' and p.instrument_status = 'pending'), 0)
    into v_paid, v_pending
  from public.payment_allocations a
  join public.payments p on p.id = a.payment_id
  where a.installment_id = p_installment;

  update public.installments i set
    amount_paid    = v_paid,
    amount_pending = v_pending,
    status = (case
               when i.waived_amount >= i.amount_due then 'waived'
               when v_paid + i.waived_amount >= i.amount_due + i.late_fee then 'paid'
               when v_paid > 0 then 'partially_paid'
               when i.due_date is not null and i.due_date < v_today then 'overdue'
               else 'pending'
             end)::public.installment_status,
    days_overdue = case
                     when i.due_date is not null and i.due_date < v_today
                          and v_paid + i.waived_amount < i.amount_due + i.late_fee
                     then (v_today - i.due_date)
                     else 0
                   end
  where i.id = p_installment;
end $$;

-- Keep an installment honest whenever its allocations change.
create or replace function private.alloc_recompute() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.recompute_installment(coalesce(new.installment_id, old.installment_id));
  return null;
end $$;
create trigger payment_allocations_recompute after insert or update or delete on public.payment_allocations
  for each row execute function private.alloc_recompute();

-- Unit status follows the live sale (and, from Phase 4, the live lease).
-- A unit is "sold" only once the whole down payment has cleared (docs/02-business-rules.md Q4).
create or replace function private.refresh_unit_status(p_unit uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sale public.sales; v_due numeric(14,2); v_settled numeric(14,2); v_next public.unit_status;
begin
  select * into v_sale from public.sales
  where unit_id = p_unit and status in ('booked','active') and deleted_at is null
  limit 1;

  if v_sale.id is null then
    -- no live sale: keep a manual hold or block, otherwise the unit is free again
    select (case when status in ('on_hold','blocked') then status else 'available' end)::public.unit_status
      into v_next from public.units where id = p_unit;
  else
    select coalesce(sum(amount_due), 0), coalesce(sum(amount_paid + waived_amount), 0)
      into v_due, v_settled
    from public.installments
    where sale_id = v_sale.id and type = 'down_payment' and deleted_at is null;

    v_next := (case when v_due > 0 and v_settled >= v_due then 'sold' else 'booked' end)::public.unit_status;
  end if;

  perform set_config('app.system_status', 'on', true);
  update public.units set status = v_next where id = p_unit and status is distinct from v_next;
  perform set_config('app.system_status', '', true);
end $$;

-- Waystar earns its percentage as money is collected, not at booking (Q6).
create or replace function private.refresh_commission(p_sale uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sale public.sales; v_cleared numeric(14,2);
begin
  select * into v_sale from public.sales where id = p_sale;
  if v_sale.id is null then return; end if;

  select coalesce(sum(amount), 0) into v_cleared from public.payments
  where sale_id = p_sale and private.payment_is_cleared(status, instrument_status);

  insert into public.commissions (project_id, sale_id, agent_id, dealer_id, base_amount, rate_pct, amount, earned_amount)
  values (v_sale.project_id, p_sale, v_sale.agent_id, v_sale.dealer_id, v_sale.final_price, v_sale.commission_pct,
          round(v_sale.final_price * v_sale.commission_pct / 100, 2),
          round(v_cleared * v_sale.commission_pct / 100, 2))
  on conflict (sale_id) where sale_id is not null do update set
    base_amount   = excluded.base_amount,
    rate_pct      = excluded.rate_pct,
    amount        = excluded.amount,
    earned_amount = excluded.earned_amount,
    agent_id      = excluded.agent_id,
    dealer_id     = excluded.dealer_id;

  update public.commissions c set status = (case
      when v_sale.status = 'cancelled' then 'cancelled'
      when c.earned_amount > 0 and c.received_amount >= c.earned_amount then 'received'
      when c.received_amount > 0 then 'partially_received'
      else 'pending'
    end)::public.commission_status
  where c.sale_id = p_sale;
end $$;

-- Flags a sale when N consecutive installments are unpaid past their due date.
-- It only RAISES A FLAG: a Manager confirms every cancellation (docs/02-business-rules.md).
create or replace function private.refresh_cancellation_flag(p_sale uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_limit smallint; v_run int := 0; v_max int := 0; r record; v_today date := private.today_pk();
begin
  select p.cancel_after_consecutive_missed into v_limit
  from public.sales s join public.projects p on p.id = s.project_id where s.id = p_sale;
  if v_limit is null then
    update public.sales set cancellation_due = false where id = p_sale and cancellation_due;
    return;
  end if;

  for r in select amount_due, amount_paid, waived_amount from public.installments
           where sale_id = p_sale and deleted_at is null and due_date is not null and due_date < v_today
           order by seq
  loop
    if r.amount_paid + r.waived_amount < r.amount_due then
      v_run := v_run + 1;
      v_max := greatest(v_max, v_run);
    else
      v_run := 0;
    end if;
  end loop;

  update public.sales set cancellation_due = (v_max >= v_limit)
  where id = p_sale and cancellation_due is distinct from (v_max >= v_limit);
end $$;

/** Recompute everything derived from one sale. */
create or replace function private.refresh_sale(p_sale uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_unit uuid;
begin
  select unit_id into v_unit from public.sales where id = p_sale;
  perform private.refresh_commission(p_sale);
  perform private.refresh_cancellation_flag(p_sale);
  if v_unit is not null then perform private.refresh_unit_status(v_unit); end if;
end $$;

-- ---------------------------------------------------------------------------
-- Installment schedule
-- ---------------------------------------------------------------------------
create or replace function private.build_schedule(p_sale uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.sales; v_days smallint;
  v_final numeric(14,2); v_down numeric(14,2); v_poss numeric(14,2); v_inst numeric(14,2);
  v_each numeric(14,2); v_allocated numeric(14,2) := 0; v_amount numeric(14,2);
  v_n int; v_months int; v_seq smallint := 0; v_first date; i int;
begin
  select * into s from public.sales where id = p_sale and deleted_at is null;
  if s.id is null then
    raise exception 'Sale not found' using errcode = '42501';
  end if;
  if exists (select 1 from public.payment_allocations a
             join public.installments i on i.id = a.installment_id where i.sale_id = p_sale) then
    raise exception 'This schedule already has payments allocated to it and cannot be regenerated';
  end if;

  delete from public.installments where sale_id = p_sale;

  v_final := s.final_price;
  v_down  := round(v_final * coalesce(s.down_payment_pct, 100) / 100, 2);
  v_poss  := round(v_final * coalesce(s.possession_pct, 0) / 100, 2);
  v_inst  := v_final - v_down - v_poss;

  -- The booking amount is part of the down payment; any balance falls due a set number of
  -- days later, where the project says how many (docs/02-business-rules.md).
  select down_payment_balance_days into v_days from public.projects where id = s.project_id;

  if s.booking_amount is not null and s.booking_amount > 0 and s.booking_amount < v_down and v_days is not null then
    v_seq := v_seq + 1;
    insert into public.installments (sale_id, seq, type, label, due_date, amount_due)
    values (p_sale, v_seq, 'down_payment', 'Down Payment (at Booking)', s.booking_date, s.booking_amount);
    v_seq := v_seq + 1;
    insert into public.installments (sale_id, seq, type, label, due_date, amount_due)
    values (p_sale, v_seq, 'down_payment', 'Down Payment (balance)', s.booking_date + v_days, v_down - s.booking_amount);
  else
    v_seq := v_seq + 1;
    insert into public.installments (sale_id, seq, type, label, due_date, amount_due)
    values (p_sale, v_seq, 'down_payment',
            case when s.plan_kind = 'full_cash' then 'Full Payment' else 'Down Payment (at Booking)' end,
            s.booking_date, v_down);
  end if;

  if s.plan_kind = 'installment' and v_inst > 0 then
    v_months := private.frequency_months(s.frequency);
    v_n := greatest(1, (s.tenure_months / v_months)::int);
    v_first := coalesce(s.first_installment_date, (s.booking_date + (v_months || ' months')::interval)::date);
    v_each := trunc(v_inst / v_n, 2);   -- equal installments; the rounding difference lands on the last

    for i in 1..v_n loop
      v_amount := case when i = v_n then v_inst - v_allocated else v_each end;
      v_allocated := v_allocated + v_amount;
      v_seq := v_seq + 1;
      insert into public.installments (sale_id, seq, type, label, due_date, amount_due)
      values (p_sale, v_seq, 'installment',
              format('Installment %s of %s (%s)', i, v_n, initcap(replace(s.frequency::text, '_', '-'))),
              (v_first + ((i - 1) * v_months || ' months')::interval)::date,
              v_amount);
    end loop;
  end if;

  if v_poss > 0 then
    -- no due date: payable when SIMCO announces possession
    v_seq := v_seq + 1;
    insert into public.installments (sale_id, seq, type, label, due_date, amount_due)
    values (p_sale, v_seq, 'possession', 'On Possession', null, v_poss);
  end if;
end $$;

/** Rebuild a sale's schedule (Managers only, and only while nothing has been paid against it). */
create or replace function public.generate_installment_schedule(p_sale uuid, p_reason text default null)
returns setof public.installments
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role('super_admin','manager') then
    raise exception 'Only a Manager can rebuild an installment schedule' using errcode = '42501';
  end if;
  if not private.can_access_project(private.sale_project(p_sale)) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if p_reason is not null and length(trim(p_reason)) > 0 then
    perform set_config('app.reason', left(trim(p_reason), 500), true);
  end if;

  perform private.build_schedule(p_sale);
  perform private.refresh_sale(p_sale);
  return query select * from public.installments where sale_id = p_sale and deleted_at is null order by seq;
end $$;
revoke execute on function public.generate_installment_schedule(uuid, text) from anon, public;
grant execute on function public.generate_installment_schedule(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Booking: unit + buyers + schedule + ownership + commission, all or nothing
-- ---------------------------------------------------------------------------
create or replace function public.create_sale(p jsonb)
returns public.sales
language plpgsql security definer set search_path = '' as $$
declare
  v_sale public.sales; v_unit public.units; v_plan public.payment_plans;
  v_buyer jsonb; v_no text; v_project uuid; v_shares numeric;
begin
  -- lock the unit so two agents cannot book it in the same moment
  select * into v_unit from public.units
  where id = (p->>'unit_id')::uuid and deleted_at is null for update;
  if v_unit.id is null then
    raise exception 'Unit not found' using errcode = '42501';
  end if;
  v_project := v_unit.project_id;

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

  -- only a Manager may give a discount beyond the project threshold
  if coalesce((p->>'discount')::numeric, 0) > 0 and not private.has_role('super_admin','manager') then
    if coalesce((p->>'discount')::numeric, 0) * 100 / nullif((p->>'list_price')::numeric, 0)
       > (select discount_approval_threshold_pct from public.company_settings where id) then
      raise exception 'A discount of this size needs a Manager' using errcode = '42501';
    end if;
  end if;

  v_no := coalesce(nullif(p->>'booking_form_no',''), public.next_doc_no(v_project, 'BF'));

  insert into public.sales (
    unit_id, project_id, booking_form_no, booking_date, list_price, discount, plan_kind, payment_plan_id,
    down_payment_pct, installment_pct, possession_pct, tenure_months, frequency, booking_amount,
    first_installment_date, agent_id, dealer_id, commission_pct, notes, status, created_by)
  values (
    v_unit.id, v_project, v_no, (p->>'booking_date')::date,
    (p->>'list_price')::numeric, coalesce((p->>'discount')::numeric, 0),
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
revoke execute on function public.create_sale(jsonb) from anon, public;
grant execute on function public.create_sale(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

/** Oldest due first (SIMCO's own rule), skipping anything already settled. */
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
    select i.id, (i.amount_due + i.late_fee - i.waived_amount - i.amount_paid - i.amount_pending) as outstanding
    from public.installments i
    where i.sale_id = v_pay.sale_id and i.deleted_at is null and i.status <> 'waived'
    order by i.due_date nulls last, i.seq
  loop
    exit when v_left <= 0;
    if r.outstanding > 0 then
      v_take := least(v_left, r.outstanding);
      insert into public.payment_allocations (payment_id, installment_id, amount, created_by)
      values (p_payment, r.id, v_take, auth.uid());
      v_left := v_left - v_take;
    end if;
  end loop;
  -- anything left over stays unallocated: an advance on account, visible in the ledger
end $$;

create or replace function public.allocate_payment(p_payment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pay public.payments;
begin
  select * into v_pay from public.payments where id = p_payment;
  if v_pay.id is null or not private.can_handle_money(v_pay.project_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  perform private.allocate(p_payment);
  perform private.refresh_sale(v_pay.sale_id);
end $$;
revoke execute on function public.allocate_payment(uuid) from anon, public;
grant execute on function public.allocate_payment(uuid) to authenticated;

create or replace function public.record_payment(p jsonb)
returns public.payments
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments; v_sale public.sales; v_mode public.payment_mode; v_instr public.instrument_status;
begin
  select * into v_sale from public.sales where id = (p->>'sale_id')::uuid and deleted_at is null;
  if v_sale.id is null then
    raise exception 'Sale not found' using errcode = '42501';
  end if;
  if not private.can_handle_money(v_sale.project_id) then
    raise exception 'Only Accounts and Managers can record payments' using errcode = '42501';
  end if;
  if v_sale.status in ('cancelled','transferred') then
    raise exception 'This sale is % — payments cannot be recorded against it', v_sale.status;
  end if;

  v_mode  := (p->>'mode')::public.payment_mode;
  v_instr := case when v_mode in ('cash','online') then 'not_applicable'::public.instrument_status
                  else coalesce(nullif(p->>'instrument_status','')::public.instrument_status, 'pending') end;

  insert into public.payments (
    project_id, sale_id, receipt_no, received_on, amount, mode, bank_name, instrument_no, instrument_date,
    instrument_status, cleared_on, received_by, payer_client_id, notes, created_by)
  values (
    v_sale.project_id, v_sale.id,
    coalesce(nullif(p->>'receipt_no',''), public.next_doc_no(v_sale.project_id, 'RCPT')),
    (p->>'received_on')::date, (p->>'amount')::numeric, v_mode,
    nullif(p->>'bank_name',''), nullif(p->>'instrument_no',''), nullif(p->>'instrument_date','')::date,
    v_instr,
    case when v_instr = 'cleared' then coalesce(nullif(p->>'cleared_on','')::date, (p->>'received_on')::date) end,
    coalesce(nullif(p->>'received_by','')::uuid, auth.uid()),
    nullif(p->>'payer_client_id','')::uuid, nullif(p->>'notes',''), auth.uid())
  returning * into v_pay;

  perform private.allocate(v_pay.id);
  update public.sales set status = 'active' where id = v_sale.id and status = 'booked';
  perform private.refresh_sale(v_sale.id);

  select * into v_pay from public.payments where id = v_pay.id;
  return v_pay;
end $$;
revoke execute on function public.record_payment(jsonb) from anon, public;
grant execute on function public.record_payment(jsonb) to authenticated;

/** Hand-steer which installments a payment settles. */
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
      insert into public.payment_allocations (payment_id, installment_id, amount, created_by)
      select p_payment, i.id, (a->>'amount')::numeric, auth.uid()
      from public.installments i
      where i.id = (a->>'installment_id')::uuid and i.sale_id = v_pay.sale_id and i.deleted_at is null;
    end if;
  end loop;

  perform private.refresh_sale(v_pay.sale_id);
end $$;
revoke execute on function public.set_payment_allocations(uuid, jsonb, text) from anon, public;
grant execute on function public.set_payment_allocations(uuid, jsonb, text) to authenticated;

/** A cheque / pay order / transfer cleared the bank. Only now does it count as money. */
create or replace function public.clear_instrument(p_payment uuid, p_cleared_on date default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pay public.payments;
begin
  select * into v_pay from public.payments where id = p_payment;
  if v_pay.id is null or not private.can_handle_money(v_pay.project_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;

  update public.payments set instrument_status = 'cleared',
         cleared_on = coalesce(p_cleared_on, private.today_pk()), bounced_reason = null
  where id = p_payment and status = 'valid' and instrument_status in ('pending','bounced')
  returning * into v_pay;
  if v_pay.id is null then
    raise exception 'That receipt is already cleared, reversed, or needs no clearing' using errcode = '42501';
  end if;

  perform private.allocate(p_payment);   -- a bounced cheque had its allocations removed
  perform private.refresh_sale(v_pay.sale_id);
end $$;

create or replace function public.bounce_instrument(p_payment uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pay public.payments;
begin
  select * into v_pay from public.payments where id = p_payment;
  if v_pay.id is null or not private.can_handle_money(v_pay.project_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Give the reason the instrument bounced';
  end if;
  perform set_config('app.reason', left(trim(p_reason), 500), true);

  update public.payments set instrument_status = 'bounced', cleared_on = null, bounced_reason = trim(p_reason)
  where id = p_payment and status = 'valid' and instrument_status in ('pending','cleared')
  returning * into v_pay;
  if v_pay.id is null then
    raise exception 'That receipt is reversed, or has no instrument to bounce' using errcode = '42501';
  end if;

  delete from public.payment_allocations where payment_id = p_payment;  -- it settled nothing after all
  perform private.refresh_sale(v_pay.sale_id);
end $$;

/** Receipts are never deleted. Reversing one keeps the record and the reason. */
create or replace function public.reverse_payment(p_payment uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pay public.payments;
begin
  select * into v_pay from public.payments where id = p_payment;
  if v_pay.id is null or not private.can_handle_money(v_pay.project_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Give the reason this receipt is being reversed';
  end if;
  perform set_config('app.reason', left(trim(p_reason), 500), true);

  update public.payments set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(),
         reversal_reason = trim(p_reason)
  where id = p_payment and status = 'valid'
  returning * into v_pay;
  if v_pay.id is null then
    raise exception 'That receipt is already reversed' using errcode = '42501';
  end if;

  delete from public.payment_allocations where payment_id = p_payment;
  perform private.refresh_sale(v_pay.sale_id);
end $$;

revoke execute on function public.clear_instrument(uuid, date), public.bounce_instrument(uuid, text),
                          public.reverse_payment(uuid, text) from anon, public;
grant execute on function public.clear_instrument(uuid, date), public.bounce_instrument(uuid, text),
                         public.reverse_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Receipts are append-only: no deletes, and the amount cannot be edited afterwards
-- ---------------------------------------------------------------------------
create or replace function private.guard_payment() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'A receipt can never be deleted. Reverse it instead, with a reason.' using errcode = '42501';
  end if;
  if new.amount is distinct from old.amount or new.sale_id is distinct from old.sale_id
     or new.receipt_no is distinct from old.receipt_no then
    raise exception 'The amount, sale and receipt number of a receipt cannot be changed. Reverse it instead.'
      using errcode = '42501';
  end if;
  return new;
end $$;
create trigger payments_guard before update or delete on public.payments
  for each row execute function private.guard_payment();

-- Nightly job (scheduled in Phase 5): mark overdue and refresh the cancellation flags.
create or replace function public.mark_overdue() returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; r record;
begin
  for r in select id from public.installments
           where deleted_at is null and due_date is not null and due_date < private.today_pk()
             and status in ('pending','partially_paid','overdue')
  loop
    perform private.recompute_installment(r.id);
    v_count := v_count + 1;
  end loop;

  for r in select id from public.sales where status in ('booked','active') and deleted_at is null loop
    perform private.refresh_cancellation_flag(r.id);
  end loop;
  return v_count;
end $$;
revoke execute on function public.mark_overdue() from anon, public, authenticated;

grant execute on all functions in schema private to authenticated, service_role;
