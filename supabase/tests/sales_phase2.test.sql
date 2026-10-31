-- pgTAP: Phase 2 — booking, schedule generation, payment allocation, clearing,
-- reversal, derived unit status and commission, and who is allowed to do what.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Act as a real signed-in user: both the role (so RLS applies) and the JWT claim
-- (so auth.uid() inside the functions resolves).
create or replace function pg_temp.login(p_email text) returns void language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- count the rows a statement actually touched (RLS silently filters, it does not raise)
create or replace function pg_temp.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

-- a free Simco Villas plot and a client to buy it
create temp table t as
select (select u.id from public.units u
         where u.project_id = (select id from public.projects where code = 'SV')
           and u.status = 'available' and u.category = 'plot'
         order by u.unit_no desc limit 1) as unit_id,
       (select id from public.clients where cnic = '61101-7788990-8') as client_id,
       (select id from public.payment_plans where kind = 'installment'
          and project_id = (select id from public.projects where code = 'SV')) as plan_id,
       (select id from auth.users where email = 'agent@waystar.test') as agent_id;
grant select on t to authenticated;

create or replace function pg_temp.book(p_price numeric default 10000000, p_discount numeric default 0)
returns uuid language plpgsql as $$
declare v_sale public.sales;
begin
  v_sale := public.create_sale(jsonb_build_object(
    'unit_id', (select unit_id from t), 'booking_date', (now() at time zone 'Asia/Karachi')::date,
    'plan_kind', 'installment', 'payment_plan_id', (select plan_id from t),
    'list_price', p_price, 'discount', p_discount,
    'buyers', jsonb_build_array(jsonb_build_object(
      'client_id', (select client_id from t), 'share_pct', 100, 'is_primary', true))));
  return v_sale.id;
end $$;

-- ---------------------------------------------------------------- booking (as an agent)
select pg_temp.login('agent@waystar.test');
select lives_ok($$ select pg_temp.book() $$, 'an agent can book an available plot');

-- the schedule must add up to the sale price to the paisa
select is((select sum(amount_due) from public.installments i
           join public.sales s on s.id = i.sale_id where s.unit_id = (select unit_id from t)),
          10000000.00::numeric, 'the schedule adds up to exactly the sale price');
select is((select count(*)::int from public.installments i
           join public.sales s on s.id = i.sale_id where s.unit_id = (select unit_id from t)),
          9, '30% down plus 8 quarterly installments = 9 rows');
select is((select i.amount_due from public.installments i join public.sales s on s.id = i.sale_id
           where s.unit_id = (select unit_id from t) and i.type = 'down_payment'),
          3000000.00::numeric, 'the down payment is 30% of the price');
select is((select count(distinct i.amount_due)::int from public.installments i
           join public.sales s on s.id = i.sale_id
           where s.unit_id = (select unit_id from t) and i.type = 'installment'),
          1, 'the quarterly installments are equal (nothing left over to round)');
select is((select count(*)::int from public.installments i join public.sales s on s.id = i.sale_id
           where s.unit_id = (select unit_id from t) and i.due_date is null),
          0, 'every installment on this plan has a due date');
select is((select u.status from public.units u where u.id = (select unit_id from t)),
          'booked'::public.unit_status, 'booking the plot marks it booked, not sold');

select throws_ok($$ select pg_temp.book() $$, null, null, 'the same plot cannot be booked twice');

select throws_ok($$ select public.create_sale(jsonb_build_object(
    'unit_id', (select u.id from public.units u where u.status = 'available' and u.category = 'plot' limit 1),
    'booking_date', (now() at time zone 'Asia/Karachi')::date, 'plan_kind', 'full_cash',
    'list_price', 1000000, 'discount', 200000,
    'buyers', jsonb_build_array(jsonb_build_object('client_id', (select client_id from t), 'share_pct', 100, 'is_primary', true)))) $$,
  '42501', null, 'an agent cannot give a negotiated discount (beyond the standard full-payment one)');

select throws_ok($$ select public.record_payment(jsonb_build_object(
    'sale_id', (select id from public.sales where unit_id = (select unit_id from t)),
    'received_on', (now() at time zone 'Asia/Karachi')::date, 'amount', 1000, 'mode', 'cash')) $$,
  '42501', null, 'an agent cannot record a payment');

select is((select count(*)::int from public.sales where agent_id is distinct from (select agent_id from t)),
          0, 'an agent sees only their own sales');
select pg_temp.logout();

-- ---------------------------------------------------------------- payments (as accounts)
select pg_temp.login('accounts@waystar.test');

-- a cheque that has not cleared is not money yet
select lives_ok($$ select public.record_payment(jsonb_build_object(
    'sale_id', (select id from public.sales where unit_id = (select unit_id from t)),
    'received_on', (now() at time zone 'Asia/Karachi')::date, 'amount', 3000000,
    'mode', 'cheque', 'bank_name', 'HBL', 'instrument_no', 'CHQ-1')) $$,
  'accounts can record a cheque');
select is((select u.status from public.units u where u.id = (select unit_id from t)),
          'booked'::public.unit_status, 'an uncleared cheque does not make the plot sold');
select is((select l.total_paid from public.v_sale_ledger l
           where l.sale_id = (select id from public.sales where unit_id = (select unit_id from t))),
          0.00::numeric, 'an uncleared cheque counts as nothing paid');
select is((select l.total_pending from public.v_sale_ledger l
           where l.sale_id = (select id from public.sales where unit_id = (select unit_id from t))),
          3000000.00::numeric, '…but it does show as pending');
select is((select c.earned_amount from public.commissions c
           where c.sale_id = (select id from public.sales where unit_id = (select unit_id from t))),
          0.00::numeric, 'no commission is earned on money that has not cleared');

-- clearing it settles the down payment, and the plot becomes sold
select lives_ok($$ select public.clear_instrument((select id from public.payments where instrument_no = 'CHQ-1')) $$,
                'the cheque can be cleared');
select is((select u.status from public.units u where u.id = (select unit_id from t)),
          'sold'::public.unit_status, 'once the down payment clears, the plot is sold');
select is((select c.earned_amount from public.commissions c
           where c.sale_id = (select id from public.sales where unit_id = (select unit_id from t))),
          150000.00::numeric, 'commission is earned pro-rata: 5% of the 3,000,000 collected');
select is((select i.seq from public.installments i
           join public.payment_allocations a on a.installment_id = i.id
           join public.payments p on p.id = a.payment_id where p.instrument_no = 'CHQ-1'),
          1::smallint, 'a payment settles the oldest unpaid installment first');

-- a payment larger than one installment spills over to the next
select lives_ok($$ select public.record_payment(jsonb_build_object(
    'sale_id', (select id from public.sales where unit_id = (select unit_id from t)),
    'received_on', (now() at time zone 'Asia/Karachi')::date, 'amount', 1000000, 'mode', 'cash')) $$,
  'a larger payment can be recorded');
select is((select count(*)::int from public.payment_allocations a join public.payments p on p.id = a.payment_id
           where p.mode = 'cash' and p.sale_id = (select id from public.sales where unit_id = (select unit_id from t))),
          2, 'it spills across two installments');

-- a bounced cheque settles nothing
select lives_ok($$ select public.bounce_instrument(
    (select id from public.payments where instrument_no = 'CHQ-1'), 'insufficient funds') $$, 'a cheque can bounce');
select is((select u.status from public.units u where u.id = (select unit_id from t)),
          'booked'::public.unit_status, 'a bounced cheque takes the plot back to booked');
select is((select count(*)::int from public.payment_allocations a join public.payments p on p.id = a.payment_id
           where p.instrument_no = 'CHQ-1'), 0, 'a bounced cheque settles nothing');

-- receipts cannot be deleted or edited through the API
select is(pg_temp.affected($q$ delete from public.payments where instrument_no = 'CHQ-1' $q$), 0,
          'no one can delete a receipt through the API');
select is(pg_temp.affected($q$ update public.payments set amount = 1 where instrument_no = 'CHQ-1' $q$), 0,
          'no one can edit a receipt through the API');

select throws_ok($$ select public.reverse_payment((select id from public.payments where instrument_no = 'CHQ-1'), 'x') $$,
                 null, null, 'reversing a receipt needs a real reason');
select lives_ok($$ select public.reverse_payment(
    (select id from public.payments where instrument_no = 'CHQ-1'), 'Recorded against the wrong plot') $$,
  'a receipt can be reversed with a reason');
select is((select status from public.payments where instrument_no = 'CHQ-1'),
          'reversed'::public.record_status, 'the reversed receipt is kept, not deleted');
select is((select count(distinct receipt_no)::int from public.payments where receipt_no like 'SV-RCPT-%'),
          (select count(*)::int from public.payments where receipt_no like 'SV-RCPT-%'),
          'receipt numbers are unique');
select pg_temp.logout();

-- the guard trigger is the second line of defence, below RLS
select throws_ok($$ delete from public.payments where instrument_no = 'CHQ-1' $$,
                 '42501', null, 'the database itself refuses to delete a receipt');
select throws_ok($$ update public.payments set amount = 1 where instrument_no = 'CHQ-1' $$,
                 '42501', null, 'the database itself refuses to change a receipt amount');

-- ---------------------------------------------------------------- visibility
select pg_temp.login('viewer@waystar.test');
select ok((select count(*) from public.sales) > 0, 'a viewer can read sales');
select throws_ok($$ select public.record_payment(jsonb_build_object(
    'sale_id', (select id from public.sales limit 1),
    'received_on', (now() at time zone 'Asia/Karachi')::date, 'amount', 1, 'mode', 'cash')) $$,
  '42501', null, 'a viewer cannot record a payment');
select is((select count(*)::int from public.doc_sequences), 0, 'a viewer cannot read the number sequences');
select pg_temp.logout();

-- ---------------------------------------------------------------- default is flagged, never automatic
select ok((select cancellation_due from public.sales where booking_form_no = 'SV-BF-2026-000004'),
          'a sale with two consecutive missed installments is flagged for a Manager');
select is((select status from public.sales where booking_form_no = 'SV-BF-2026-000004'),
          'active'::public.sale_status, '…but it is never cancelled automatically');

select * from finish();
rollback;
