create or replace function private.next_doc_no(p_project uuid, p_doc_type text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text; v_year smallint := extract(year from private.today_pk())::smallint; v_no int;
begin
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
revoke execute on function private.next_doc_no(uuid, text) from public, anon, authenticated;

create or replace function public.next_doc_no(p_project uuid, p_doc_type text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  return private.next_doc_no(p_project, p_doc_type);
end $$;

create or replace function private.refresh_unit_status(p_unit uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sale public.sales; v_due numeric(14,2); v_settled numeric(14,2); v_next public.unit_status;
begin
  if exists (select 1 from public.leases where unit_id = p_unit and status = 'active') then
    perform set_config('app.system_status', 'on', true);
    update public.units set status = 'rented' where id = p_unit and status <> 'rented';
    perform set_config('app.system_status', '', true);
    return;
  end if;

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

create view public.v_rent_invoice_balances with (security_invoker = true) as
select i.*, l.project_id,
       coalesce(a.paid, 0) as amount_paid,
       i.amount_due - coalesce(a.paid, 0) as outstanding,
       case when i.amount_due > coalesce(a.paid, 0)
         then greatest(0, private.today_pk() - i.due_date) else 0 end as days_overdue
from public.rent_invoices i
join public.leases l on l.id = i.lease_id
left join lateral (
  select sum(amount) as paid from public.rent_payment_allocations
  where rent_invoice_id = i.id
) a on true;

create view public.v_rent_receivables with (security_invoker = true) as
select i.*, case
  when i.days_overdue = 0 then 'current'
  when i.days_overdue <= 30 then '1-30'
  when i.days_overdue <= 60 then '31-60'
  when i.days_overdue <= 90 then '61-90'
  else '90+' end as ageing_bucket
from public.v_rent_invoice_balances i
where i.outstanding > 0;

create view public.v_rent_payment_totals with (security_invoker = true) as
select p.*, l.project_id,
       coalesce(p.cleared_on, p.received_on) as effective_date,
       case when private.payment_is_cleared(p.status, p.instrument_status)
         then p.amount - coalesce(a.penalty, 0) else 0 end as rent_collected,
       case when private.payment_is_cleared(p.status, p.instrument_status)
         then coalesce(a.penalty, 0) else 0 end as penalties_collected,
       case when private.payment_is_cleared(p.status, p.instrument_status)
         then round((p.amount - coalesce(a.penalty, 0)) * l.commission_pct / 100, 2) else 0 end as commission_earned
from public.rent_payments p
join public.leases l on l.id = p.lease_id
left join lateral (
  select sum(amount) as penalty from public.rent_payment_allocations
  where rent_payment_id = p.id and component = 'late_fee'
) a on true;

create view public.v_lease_ledger with (security_invoker = true) as
select l.id as lease_id, l.project_id,
       coalesce(i.rent_billed, 0) as rent_billed,
       coalesce(p.rent_collected, 0) as rent_collected,
       coalesce(p.penalties_collected, 0) as penalties_collected,
       coalesce(p.pending_clearance, 0) as pending_clearance,
       coalesce(i.outstanding, 0) as outstanding,
       coalesce(i.overdue, 0) as overdue,
       coalesce(d.held, 0) as deposit_held,
       coalesce(p.commission_earned, 0) as commission_earned,
       coalesce(o.paid_out, 0) as paid_out,
       coalesce(p.rent_collected, 0) - coalesce(p.commission_earned, 0) - coalesce(o.paid_out, 0) as owed_to_landlord
from public.leases l
left join lateral (
  select sum(rent_amount) as rent_billed, sum(outstanding) as outstanding,
         sum(outstanding) filter (where days_overdue > 0) as overdue
  from public.v_rent_invoice_balances where lease_id = l.id
) i on true
left join lateral (
  select sum(rent_collected) as rent_collected, sum(commission_earned) as commission_earned,
         sum(penalties_collected) as penalties_collected,
         sum(amount) filter (where status = 'valid' and instrument_status = 'pending') as pending_clearance
  from public.v_rent_payment_totals where lease_id = l.id
) p on true
left join lateral (
  select sum(case when type = 'refunded' then -amount else amount end) as held
  from public.deposit_transactions where lease_id = l.id
) d on true
left join lateral (
  select sum(amount) as paid_out from public.owner_payouts where lease_id = l.id and status = 'valid'
) o on true;

revoke all on public.v_lease_ledger, public.v_rent_invoice_balances, public.v_rent_receivables,
  public.v_rent_payment_totals from anon;
grant select on public.v_lease_ledger, public.v_rent_invoice_balances, public.v_rent_receivables,
  public.v_rent_payment_totals to authenticated;

-- All callers hold the lease lock. Rebuild allocations in clearance order so a reversal
-- frees capacity for later cleared receipts and new invoices absorb advances.
create function private.refresh_rent_ledger(p_lease uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_payment record;
  v_invoice record;
  v_left numeric;
  v_take numeric;
  v_component text;
  v_total record;
begin
  delete from public.rent_payment_allocations a using public.rent_payments p
  where a.rent_payment_id = p.id and p.lease_id = p_lease;

  for v_payment in
    select * from public.rent_payments
    where lease_id = p_lease and private.payment_is_cleared(status, instrument_status)
    order by coalesce(cleared_on, received_on), receipt_no
  loop
    v_left := v_payment.amount;
    for v_invoice in
      select i.id,
        i.rent_amount - coalesce(sum(a.amount) filter (where a.component = 'rent'), 0) as rent,
        i.late_fee - i.waived_amount - coalesce(sum(a.amount) filter (where a.component = 'late_fee'), 0) as late_fee
      from public.rent_invoices i
      left join public.rent_payment_allocations a on a.rent_invoice_id = i.id
      where i.lease_id = p_lease
      group by i.id
      having i.amount_due > coalesce(sum(a.amount), 0)
      order by i.period
    loop
      foreach v_component in array array['rent', 'late_fee'] loop
        v_take := least(v_left, case when v_component = 'rent' then v_invoice.rent else v_invoice.late_fee end);
        if v_take > 0 then
          insert into public.rent_payment_allocations (rent_payment_id, rent_invoice_id, component, amount)
          values (v_payment.id, v_invoice.id, v_component, v_take);
          v_left := v_left - v_take;
        end if;
      end loop;
      exit when v_left = 0;
    end loop;
  end loop;

  select * into v_total from public.v_lease_ledger where lease_id = p_lease;
  insert into public.commissions (project_id, lease_id, agent_id, dealer_id, rate_pct, base_amount, amount, earned_amount)
  select project_id, id, agent_id, dealer_id, commission_pct, v_total.rent_billed,
         round(v_total.rent_billed * commission_pct / 100, 2), v_total.commission_earned
  from public.leases where id = p_lease
  on conflict (lease_id) where lease_id is not null do update set
    base_amount = excluded.base_amount, amount = excluded.amount, earned_amount = excluded.earned_amount;
end $$;

create function private.lock_lease(p_lease uuid, p_manager boolean) returns public.leases
language plpgsql security definer set search_path = '' as $$
declare v_lease public.leases;
begin
  select * into v_lease from public.leases where id = p_lease;
  if not coalesce(private.can_handle_money(v_lease.project_id), false)
     or (p_manager and not private.has_role('super_admin','manager')) then
    raise exception 'You do not have permission to change this lease' using errcode = '42501';
  end if;
  select * into strict v_lease from public.leases where id = p_lease for update;
  return v_lease;
end $$;

create function private.generate_rent_invoices(p_lease uuid, p_through date) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_lease public.leases;
  v_period date;
  v_first date;
  v_year int;
  v_rent numeric;
  v_count int := 0;
  v_months int := 0;
begin
  select * into strict v_lease from public.leases where id = p_lease for update;
  if v_lease.status <> 'active' then return 0; end if;
  v_first := date_trunc('month', v_lease.start_date)::date;
  for v_period in
    select d::date from generate_series(v_first,
      date_trunc('month', least(v_lease.end_date, p_through))::date, interval '1 month') d
    where v_lease.start_date <= p_through
  loop
    v_year := v_months / 12;
    v_rent := round(v_lease.monthly_rent * power(1 + v_lease.increment_pct / 100, v_year), 0);
    if not exists (select 1 from public.rent_invoices where lease_id = p_lease and period = v_period) then
      insert into public.rent_invoices (lease_id, invoice_no, period, due_date, rent_amount)
      values (p_lease, private.next_doc_no(v_lease.project_id, 'RINV'), v_period,
              v_period + (v_lease.rent_due_day - 1), v_rent);
      v_count := v_count + 1;
    end if;
    if v_year > 0 and v_months % 12 = 0 and v_lease.increment_pct > 0 then
      insert into public.lease_events (lease_id, type, event_date, lease_year, old_rent, new_rent)
      values (p_lease, 'rent_increased', (v_lease.start_date + make_interval(years => v_year))::date,
              v_year, round(v_lease.monthly_rent * power(1 + v_lease.increment_pct / 100, v_year - 1), 0), v_rent)
      on conflict (lease_id, lease_year) do nothing;
    end if;
    v_months := v_months + 1;
  end loop;
  if v_count > 0 then
    update public.leases set current_rent = v_rent where id = p_lease;
    perform private.refresh_rent_ledger(p_lease);
  end if;
  return v_count;
end $$;

create function public.generate_rent_invoices(p_lease uuid) returns int
language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_lease(p_lease, true);
  return private.generate_rent_invoices(p_lease, private.today_pk());
end $$;


create function private.insert_lease(p jsonb, p_renewed_from uuid) returns public.leases
language plpgsql security definer set search_path = '' as $$
declare
  v_unit public.units;
  v_lease public.leases;
  v_settings public.company_settings;
  v_landlord uuid := nullif(p->>'landlord_client_id', '')::uuid;
  v_tenant uuid := nullif(p->>'tenant_client_id', '')::uuid;
  v_start date := (p->>'start_date')::date;
  v_end date := (p->>'end_date')::date;
  v_rent numeric(14,2) := (p->>'monthly_rent')::numeric;
begin
  if not private.has_role('super_admin','manager') then
    raise exception 'Only Managers can create leases' using errcode = '42501';
  end if;
  select * into v_unit from public.units where id = (p->>'unit_id')::uuid and deleted_at is null for update;
  if v_unit.id is null or not private.can_access_project(v_unit.project_id) then
    raise exception 'Unit not found or access denied' using errcode = '42501';
  end if;
  if exists (select 1 from public.leases where unit_id = v_unit.id and status = 'active') then
    raise exception 'This unit already has an active lease';
  end if;
  if v_unit.status not in ('available', 'on_hold', 'sold') then
    raise exception 'A % unit cannot be leased', v_unit.status;
  end if;
  if v_unit.status = 'sold' then
    if not exists (select 1 from public.unit_ownerships
                   where unit_id = v_unit.id and client_id = v_landlord and valid_to is null) then
      raise exception 'Choose a current owner as landlord for this sold unit';
    end if;
  elsif v_landlord is not null then
    raise exception 'SIMCO must be the landlord for an unsold unit';
  end if;
  if not exists (select 1 from public.clients where id = v_tenant and deleted_at is null) then
    raise exception 'Choose a tenant';
  end if;
  if v_start is null or v_end is null or v_end < v_start then
    raise exception 'Enter a valid lease start and end date';
  end if;
  if v_rent is null or v_rent < 1 then
    raise exception 'Monthly rent must be at least one rupee';
  end if;

  select * into v_settings from public.company_settings limit 1;
  insert into public.leases (
    unit_id, project_id, agreement_no, landlord_client_id, tenant_client_id, start_date, end_date,
    monthly_rent, current_rent, security_deposit, increment_pct, rent_due_day, commission_pct,
    agent_id, dealer_id, renewed_from_id, notes)
  values (
    v_unit.id, v_unit.project_id, private.next_doc_no(v_unit.project_id, 'LSE'),
    v_landlord, v_tenant, v_start, v_end, v_rent, round(v_rent, 0),
    coalesce((p->>'security_deposit')::numeric, 0),
    coalesce((p->>'increment_pct')::numeric, v_settings.default_rent_increment_pct, 10),
    coalesce((p->>'rent_due_day')::smallint, 1),
    coalesce((p->>'commission_pct')::numeric, v_settings.default_lease_commission_pct, 5),
    nullif(p->>'agent_id', '')::uuid, nullif(p->>'dealer_id', '')::uuid, p_renewed_from, nullif(p->>'notes', ''))
  returning * into v_lease;
  insert into public.lease_events (lease_id, type, event_date)
  values (v_lease.id, 'created', private.today_pk());
  perform private.generate_rent_invoices(v_lease.id, private.today_pk());
  if v_lease.end_date < private.today_pk() then
    update public.leases set status = 'expired' where id = v_lease.id;
    insert into public.lease_events (lease_id, type, event_date)
    values (v_lease.id, 'expired', v_lease.end_date);
  end if;
  perform private.refresh_unit_status(v_unit.id);
  return (select l from public.leases l where id = v_lease.id);
end $$;

create function public.create_lease(p jsonb) returns public.leases
language sql security definer set search_path = '' as $$
  select private.insert_lease(p, null)
$$;

create function private.rental_reason(p_reason text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Enter a reason'; end if;
  perform set_config('app.reason', left(trim(p_reason), 500), true);
  return trim(p_reason);
end $$;

create function public.terminate_lease(p_lease uuid, p_date date, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_lease public.leases;
begin
  perform 1 from public.units where id = (select unit_id from public.leases where id = p_lease) for update;
  v_lease := private.lock_lease(p_lease, true);
  if v_lease.status <> 'active' then raise exception 'Only an active lease can be terminated'; end if;
  if p_date is null or p_date not between v_lease.start_date and least(v_lease.end_date, private.today_pk()) then
    raise exception 'Enter a termination date within the lease term and no later than today';
  end if;
  p_reason := private.rental_reason(p_reason);
  -- TODO(owner): decide how to handle invoices already issued after a backdated termination.
  if exists (select 1 from public.rent_invoices where lease_id = p_lease and period > p_date) then
    raise exception 'This lease already has invoices for later months';
  end if;
  perform private.generate_rent_invoices(p_lease, p_date);
  update public.leases set status = 'terminated', terminated_on = p_date, termination_reason = p_reason
  where id = p_lease;
  insert into public.lease_events (lease_id, type, event_date, details)
  values (p_lease, 'terminated', p_date, p_reason);
  perform private.refresh_unit_status(v_lease.unit_id);
end $$;

create function public.renew_lease(p jsonb) returns public.leases
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p->>'lease_id')::uuid;
  v_old public.leases;
  v_new public.leases;
  v_start date := (p->>'start_date')::date;
begin
  perform 1 from public.units where id = (select unit_id from public.leases where id = v_id) for update;
  v_old := private.lock_lease(v_id, true);
  if v_old.status not in ('active','expired') then raise exception 'Only active or expired leases can be renewed'; end if;
  if v_start is null or v_start <= v_old.end_date then
    raise exception 'The renewal must start after the previous lease ends';
  end if;
  -- TODO(owner): confirm how to schedule renewals before the current term expires.
  if v_old.end_date >= private.today_pk() then
    raise exception 'Renew the lease after its current term ends';
  end if;
  perform private.generate_rent_invoices(v_id, v_old.end_date);
  update public.leases set status = 'renewed' where id = v_id;
  perform private.refresh_unit_status(v_old.unit_id);
  v_new := private.insert_lease(to_jsonb(v_old) || p || jsonb_build_object('unit_id', v_old.unit_id), v_id);
  insert into public.lease_events (lease_id, type, event_date, details)
  values (v_id, 'renewed', private.today_pk(), v_new.agreement_no);
  return v_new;
end $$;

create function public.record_rent_payment(p jsonb) returns public.rent_payments
language plpgsql security definer set search_path = '' as $$
declare
  v_lease public.leases := private.lock_lease((p->>'lease_id')::uuid, false);
  v_payment public.rent_payments;
  v_mode public.payment_mode := (p->>'mode')::public.payment_mode;
  v_amount numeric(14,2) := (p->>'amount')::numeric;
  v_received date := (p->>'received_on')::date;
begin
  if v_amount is null or v_amount <= 0 or v_mode is null or v_received is null then
    raise exception 'Enter a positive amount, payment mode and received date';
  end if;
  perform private.generate_rent_invoices(v_lease.id, private.today_pk());
  insert into public.rent_payments (
    lease_id, receipt_no, received_on, amount, mode, bank_name, instrument_no, instrument_date, instrument_status, notes)
  values (
    v_lease.id, private.next_doc_no(v_lease.project_id, 'RENT'), v_received, v_amount, v_mode,
    nullif(p->>'bank_name', ''), nullif(p->>'instrument_no', ''), nullif(p->>'instrument_date', '')::date,
    case when v_mode in ('cash','online') then 'not_applicable' else 'pending' end::public.instrument_status,
    nullif(p->>'notes', ''))
  returning * into v_payment;
  perform private.refresh_rent_ledger(v_lease.id);
  return v_payment;
end $$;

create function public.clear_rent_instrument(p_payment uuid, p_cleared_on date default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_lease public.leases;
begin
  v_lease := private.lock_lease((select lease_id from public.rent_payments where id = p_payment), false);
  update public.rent_payments set instrument_status = 'cleared', bounced_reason = null,
    cleared_on = coalesce(p_cleared_on, private.today_pk())
  where id = p_payment and status = 'valid' and instrument_status in ('pending','bounced')
    and received_on <= coalesce(p_cleared_on, private.today_pk());
  if not found then raise exception 'Choose an uncleared instrument and a date on or after receipt'; end if;
  perform private.refresh_rent_ledger(v_lease.id);
end $$;

create function public.bounce_rent_instrument(p_payment uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_lease public.leases;
begin
  v_lease := private.lock_lease((select lease_id from public.rent_payments where id = p_payment), false);
  update public.rent_payments set instrument_status = 'bounced', cleared_on = null,
    bounced_reason = private.rental_reason(p_reason)
  where id = p_payment and status = 'valid' and instrument_status in ('pending','cleared');
  if not found then raise exception 'This receipt has no instrument to bounce'; end if;
  perform private.refresh_rent_ledger(v_lease.id);
end $$;

create function public.reverse_rent_payment(p_payment uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_lease public.leases;
begin
  v_lease := private.lock_lease((select lease_id from public.rent_payments where id = p_payment), false);
  update public.rent_payments set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(),
    reversal_reason = private.rental_reason(p_reason)
  where id = p_payment and status = 'valid';
  if not found then raise exception 'This receipt is already reversed'; end if;
  perform private.refresh_rent_ledger(v_lease.id);
end $$;

create function private.change_rent_penalty(p_invoice uuid, p_amount numeric, p_reason text, p_waive boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_lease public.leases;
begin
  v_lease := private.lock_lease((select lease_id from public.rent_invoices where id = p_invoice), true);
  p_reason := private.rental_reason(p_reason);
  p_amount := round(p_amount, 2);
  if p_amount is null or p_amount <= 0 then raise exception 'Enter a positive amount'; end if;

  if p_waive then
    update public.rent_invoices set waived_amount = waived_amount + p_amount
    where id = p_invoice and waived_amount + p_amount <= late_fee;
    if not found then raise exception 'The waiver exceeds the remaining penalty'; end if;
  else
    update public.rent_invoices set late_fee = late_fee + p_amount where id = p_invoice;
  end if;
  insert into public.lease_events (lease_id, type, event_date, rent_invoice_id, amount, details)
  values (v_lease.id, case when p_waive then 'penalty_waived' else 'penalty_added' end::public.lease_event_type,
          private.today_pk(), p_invoice, p_amount, p_reason);
  perform private.refresh_rent_ledger(v_lease.id);
end $$;

create function public.add_rent_penalty(p_invoice uuid, p_amount numeric, p_reason text) returns void
language sql security definer set search_path = '' as $$
  select private.change_rent_penalty(p_invoice, p_amount, p_reason, false)
$$;

create function public.waive_rent(p_invoice uuid, p_amount numeric, p_reason text) returns void
language sql security definer set search_path = '' as $$
  select private.change_rent_penalty(p_invoice, p_amount, p_reason, true)
$$;

create function public.record_deposit(p jsonb) returns public.deposit_transactions
language plpgsql security definer set search_path = '' as $$
declare
  v_lease public.leases := private.lock_lease((p->>'lease_id')::uuid, false);
  v_entry public.deposit_transactions;
  v_amount numeric(14,2) := (p->>'amount')::numeric;
  v_type public.deposit_txn_type := (p->>'type')::public.deposit_txn_type;
  v_held numeric;
begin
  select deposit_held into v_held from public.v_lease_ledger where lease_id = v_lease.id;
  if v_amount is null or v_amount = 0 or (v_type <> 'adjusted' and v_amount < 0) then
    raise exception 'Enter a valid deposit amount';
  end if;
  if v_held + (case when v_type = 'refunded' then -v_amount else v_amount end) < 0 then
    raise exception 'This entry would make the deposit balance negative';
  end if;
  insert into public.deposit_transactions (lease_id, type, txn_date, amount, reason, reference_no)
  values (v_lease.id, v_type, (p->>'txn_date')::date, v_amount, private.rental_reason(p->>'reason'),
          nullif(p->>'reference_no', ''))
  returning * into v_entry;
  return v_entry;
end $$;

create function public.record_owner_payout(p jsonb) returns public.owner_payouts
language plpgsql security definer set search_path = '' as $$
declare
  v_lease public.leases := private.lock_lease((p->>'lease_id')::uuid, false);
  v_payout public.owner_payouts;
  v_balance numeric;
  v_amount numeric(14,2) := (p->>'amount')::numeric;
begin
  select owed_to_landlord into v_balance from public.v_lease_ledger where lease_id = v_lease.id;
  if v_amount is null or v_amount <= 0 or v_amount > v_balance then
    raise exception 'Enter a positive payout no greater than the balance owed';
  end if;
  if nullif(trim(p->>'reference_no'), '') is null then raise exception 'Enter a payout reference'; end if;
  insert into public.owner_payouts (lease_id, paid_on, amount, mode, reference_no)
  values (v_lease.id, (p->>'paid_on')::date, v_amount, (p->>'mode')::public.payment_mode, trim(p->>'reference_no'))
  returning * into v_payout;
  return v_payout;
end $$;

create function public.reverse_owner_payout(p_payout uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_lease((select lease_id from public.owner_payouts where id = p_payout), false);
  update public.owner_payouts set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(),
    reversal_reason = private.rental_reason(p_reason)
  where id = p_payout and status = 'valid';
  if not found then raise exception 'This payout is already reversed'; end if;
end $$;

create function private.sweep_rentals() returns void
language plpgsql security definer set search_path = '' as $$
declare v_lease public.leases;
begin
  for v_lease in select * from public.leases where status = 'active' order by project_id, unit_id loop
    perform 1 from public.units where id = v_lease.unit_id for update;
    select * into strict v_lease from public.leases where id = v_lease.id for update;
    if v_lease.status <> 'active' then continue; end if;
    perform private.generate_rent_invoices(v_lease.id, private.today_pk());
    if v_lease.end_date < private.today_pk() then
      update public.leases set status = 'expired' where id = v_lease.id;
      insert into public.lease_events (lease_id, type, event_date)
      values (v_lease.id, 'expired', v_lease.end_date);
      perform private.refresh_unit_status(v_lease.unit_id);
    end if;
  end loop;
end $$;

revoke execute on function private.refresh_rent_ledger(uuid), private.lock_lease(uuid, boolean),
  private.generate_rent_invoices(uuid, date), private.insert_lease(jsonb, uuid), private.rental_reason(text),
  private.change_rent_penalty(uuid, numeric, text, boolean), private.sweep_rentals()
from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'create_lease(jsonb)', 'generate_rent_invoices(uuid)', 'record_rent_payment(jsonb)',
    'clear_rent_instrument(uuid, date)', 'bounce_rent_instrument(uuid, text)', 'reverse_rent_payment(uuid, text)',
    'add_rent_penalty(uuid, numeric, text)', 'waive_rent(uuid, numeric, text)', 'record_deposit(jsonb)',
    'terminate_lease(uuid, date, text)', 'renew_lease(jsonb)', 'record_owner_payout(jsonb)',
    'reverse_owner_payout(uuid, text)'
  ] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

select cron.schedule('mark-overdue-daily', '30 19 * * *',
  $job$ select public.mark_overdue(); select private.sweep_rentals(); $job$);
