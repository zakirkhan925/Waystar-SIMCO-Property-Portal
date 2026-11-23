begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create temp table fixture as
select u.id as unit_id, u.project_id,
  (select id from public.clients where cnic = '61101-7788990-8') as owner_id,
  (select id from public.clients where cnic is distinct from '61101-7788990-8' order by id limit 1) as tenant_id,
  (select id from public.payment_plans where kind = 'installment' and project_id = u.project_id) as plan_id,
  null::uuid as lease_id, null::uuid as sale_id, null::uuid as invoice_id,
  null::uuid as payment_id, null::uuid as payout_id
from public.units u join public.projects p on p.id = u.project_id and p.code = 'SV'
where u.status = 'available' and u.category = 'plot'
order by u.unit_no desc limit 1;
grant select, update on fixture to authenticated;

create function pg_temp.lease_args(p_landlord uuid default null, p_months int default 26) returns jsonb
language sql as $$
  select jsonb_build_object('unit_id', unit_id, 'tenant_client_id', tenant_id, 'landlord_client_id', p_landlord,
    'start_date', (date_trunc('month', now() at time zone 'Asia/Karachi') - make_interval(months => p_months))::date,
    'end_date', (now() at time zone 'Asia/Karachi')::date + 90,
    'monthly_rent', 50000, 'increment_pct', 10, 'commission_pct', 5)
  from fixture
$$;

create function pg_temp.pay(p_mode text, p_amount numeric) returns uuid language sql as $$
  select (public.record_rent_payment(jsonb_build_object(
    'lease_id', lease_id, 'mode', p_mode, 'amount', p_amount,
    'received_on', (now() at time zone 'Asia/Karachi')::date))).id from fixture
$$;

select pg_temp.login('admin@waystar.test');
update fixture set lease_id = (public.create_lease(pg_temp.lease_args())).id;
update fixture f set invoice_id = (select id from public.rent_invoices where lease_id = f.lease_id order by period limit 1);
select is((select status::text from public.units join fixture on units.id = unit_id), 'rented', 'available unit becomes rented');
select throws_ok($$ select public.create_lease(pg_temp.lease_args()) $$, 'P0001', 'This unit already has an active lease', 'second active lease refused');
select is((select array_agg(rent_amount order by period) from (
    select i.* from public.rent_invoices i join fixture f on f.lease_id = i.lease_id order by period offset 12 limit 13
  ) i), array_fill(55000::numeric, array[12]) || 60500::numeric, 'month 13 and 25 increase by compounding');
select is((select count(*) from public.lease_events e join fixture f on f.lease_id = e.lease_id where type = 'rent_increased'),
  2::bigint, 'one event per increase');
select is((select public.generate_rent_invoices(lease_id) from fixture), 0, 'generation is idempotent');

update fixture set payment_id = pg_temp.pay('cheque', 60000);
select matches((select receipt_no from public.rent_payments where id = (select payment_id from fixture)),
  '^SV-RENT-[0-9]{4}-[0-9]{6}$', 'rent receipt uses RENT series');
select is((select amount_paid from public.v_rent_invoice_balances where id = (select invoice_id from fixture)),
  0::numeric, 'pending instrument does not settle invoices');
select public.add_rent_penalty(invoice_id, 4000, 'Manual late penalty') from fixture;
select is((select amount_due from public.rent_invoices where id = (select invoice_id from fixture)),
  54000::numeric, 'manual penalty added');
select public.waive_rent(invoice_id, 2000, 'Partial waiver') from fixture;
select is((select amount_due from public.rent_invoices where id = (select invoice_id from fixture)),
  52000::numeric, 'manual penalty waived');
select public.clear_rent_instrument(payment_id) from fixture;
select is((select array_agg(amount_paid order by period) from (
  select i.* from public.v_rent_invoice_balances i join fixture f on f.lease_id = i.lease_id order by period limit 3
) i), array[52000,8000,0]::numeric[], 'oldest invoice settles before the next one');
select is((select earned_amount from public.commissions where lease_id = (select lease_id from fixture)),
  2900::numeric, 'commission is five percent of rent and excludes penalty');
select public.bounce_rent_instrument(payment_id, 'Bank returned cheque') from fixture;
select is((select (rent_collected, commission_earned)::text from public.v_lease_ledger where lease_id = (select lease_id from fixture)),
  '(0,0)', 'bounced payment collects nothing and earns no commission');
select is((select amount_paid from public.v_rent_invoice_balances where id = (select invoice_id from fixture)),
  0::numeric, 'bounced payment settles nothing');
select public.clear_rent_instrument(payment_id) from fixture;
select public.reverse_rent_payment(payment_id, 'Wrong payment') from fixture;
select is((select (rent_collected, commission_earned)::text from public.v_lease_ledger where lease_id = (select lease_id from fixture)),
  '(0,0)', 'reversed payment collects nothing and earns no commission');
select is((select amount_paid from public.v_rent_invoice_balances where id = (select invoice_id from fixture)),
  0::numeric, 'reversed payment settles nothing');
update fixture set payment_id = pg_temp.pay('cash', 50000);
update fixture set payout_id = (public.record_owner_payout(jsonb_build_object('lease_id', lease_id,
  'amount', 10000, 'paid_on', current_date, 'mode', 'online', 'reference_no', 'SIMCO-TEST'))).id;
select is((select owed_to_landlord from public.v_lease_ledger where lease_id = (select lease_id from fixture)),
  37500::numeric, 'landlord balance subtracts commission and payouts');
select public.reverse_owner_payout(payout_id, 'Returned transfer') from fixture;
select is((select owed_to_landlord from public.v_lease_ledger where lease_id = (select lease_id from fixture)),
  47500::numeric, 'reversing a payout restores the landlord balance');
select public.record_deposit(jsonb_build_object('lease_id', lease_id, 'type', 'received',
  'amount', 30000, 'txn_date', current_date, 'reason', 'Security deposit')) from fixture;
select is((select deposit_held from public.v_lease_ledger where lease_id = (select lease_id from fixture)),
  30000::numeric, 'manual deposit is tracked separately');
select is((select earned_amount from public.commissions where lease_id = (select lease_id from fixture)),
  2500::numeric, 'deposit earns no commission');

reset role;
select pg_temp.login('viewer@waystar.test');
select throws_ok($$ select public.create_lease(pg_temp.lease_args()) $$, '42501', null, 'viewer cannot create');
select throws_ok($$ select public.generate_rent_invoices(lease_id) from fixture $$, '42501', null, 'viewer cannot generate');
select throws_ok($$ select pg_temp.pay('cash', 1000) $$, '42501', null, 'viewer cannot record payment');
select throws_ok($$ select public.clear_rent_instrument(payment_id) from fixture $$, '42501', null, 'viewer cannot clear');
select throws_ok($$ select public.bounce_rent_instrument(payment_id,'Reason') from fixture $$, '42501', null, 'viewer cannot bounce');
select throws_ok($$ select public.reverse_rent_payment(payment_id,'Reason') from fixture $$, '42501', null, 'viewer cannot reverse payment');
select throws_ok($$ select public.add_rent_penalty(invoice_id,100,'Reason') from fixture $$, '42501', null, 'viewer cannot add penalty');
select throws_ok($$ select public.waive_rent(invoice_id,100,'Reason') from fixture $$, '42501', null, 'viewer cannot waive');
select throws_ok($$ select public.record_deposit(jsonb_build_object('lease_id',lease_id)) from fixture $$, '42501', null, 'viewer cannot record deposit');
select throws_ok($$ select public.terminate_lease(lease_id,current_date,'Reason') from fixture $$, '42501', null, 'viewer cannot terminate');
select throws_ok($$ select public.renew_lease(jsonb_build_object('lease_id',lease_id)) from fixture $$, '42501', null, 'viewer cannot renew');
select throws_ok($$ select public.record_owner_payout(jsonb_build_object('lease_id',lease_id)) from fixture $$, '42501', null, 'viewer cannot pay owner');
select throws_ok($$ select public.reverse_owner_payout(payout_id,'Reason') from fixture $$, '42501', null, 'viewer cannot reverse payout');

reset role;
select pg_temp.login('agent@waystar.test');
select throws_ok($$ select public.create_lease(pg_temp.lease_args()) $$, '42501', null, 'agent cannot create lease');
select is((select count(*) from public.v_lease_ledger where lease_id = (select lease_id from fixture)),
  0::bigint, 'agent cannot see another staff member’s lease ledger');

reset role;
select pg_temp.login('admin@waystar.test');
select public.terminate_lease(lease_id, (now() at time zone 'Asia/Karachi')::date, 'Lease ended') from fixture;
select is((select status::text from public.units join fixture on units.id = unit_id), 'available', 'terminated unit returns to available');
update fixture f set sale_id = (public.create_sale(jsonb_build_object(
  'unit_id', unit_id, 'plan_kind', 'installment', 'payment_plan_id', plan_id, 'list_price', 3740000,
  'booking_date', (now() at time zone 'Asia/Karachi')::date,
  'buyers', jsonb_build_array(jsonb_build_object('client_id', owner_id, 'share_pct', 100, 'is_primary', true))))).id;
select throws_ok($$ select public.create_lease(pg_temp.lease_args()) $$, 'P0001', 'A booked unit cannot be leased',
  'booked unit cannot be leased');
select public.record_payment(jsonb_build_object('sale_id', sale_id, 'mode', 'cash', 'amount', 1122000,
  'received_on', (now() at time zone 'Asia/Karachi')::date)) from fixture;
select throws_ok($$ select public.create_lease(pg_temp.lease_args(tenant_id)) from fixture $$,
  'P0001', 'Choose a current owner as landlord for this sold unit', 'sold unit requires a current owner');
update fixture set lease_id = (public.create_lease(pg_temp.lease_args(owner_id, 0))).id;
select is((select status::text from public.units join fixture on units.id = unit_id), 'rented', 'sold unit becomes rented');
select public.terminate_lease(lease_id, (now() at time zone 'Asia/Karachi')::date, 'Lease ended') from fixture;
select is((select status::text from public.units join fixture on units.id = unit_id), 'sold', 'terminated unit returns to sold');

select * from finish();
rollback;
