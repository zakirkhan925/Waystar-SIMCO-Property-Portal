-- pgTAP: the rules the client confirmed on 30-Oct-2026 —
--   penalty charged per started month, a payment settles the installment before the penalty,
--   the balance of the down payment falls due at once, and the 5% full-payment discount.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

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

create temp table t as
select (select id from public.projects where code = 'SV') as sv,
       (select id from public.clients where cnic = '61101-7788990-8') as client_id,
       (select id from public.payment_plans where kind = 'installment'
          and project_id = (select id from public.projects where code = 'SV')) as plan_id,
       (select id from public.payment_plans where kind = 'full_cash'
          and project_id = (select id from public.projects where code = 'SV')) as cash_plan_id,
       (now() at time zone 'Asia/Karachi')::date as today;
grant select on t to authenticated;

-- book a plot whose down payment fell due a known number of days ago
create or replace function pg_temp.book(p_days_ago int, p_price numeric default 10000000,
                                        p_booking_amount numeric default null,
                                        p_kind public.plan_kind default 'installment',
                                        p_discount numeric default 0)
returns uuid language plpgsql as $$
declare v_sale public.sales; v_unit uuid;
begin
  select u.id into v_unit from public.units u
   where u.project_id = (select sv from t) and u.status = 'available' and u.category = 'plot'
   order by u.unit_no desc limit 1;
  v_sale := public.create_sale(jsonb_build_object(
    'unit_id', v_unit, 'booking_date', (select today from t) - p_days_ago,
    'plan_kind', p_kind,
    'payment_plan_id', case when p_kind = 'installment' then (select plan_id from t) else (select cash_plan_id from t) end,
    'list_price', p_price, 'discount', p_discount, 'booking_amount', p_booking_amount,
    'buyers', jsonb_build_array(jsonb_build_object(
      'client_id', (select client_id from t), 'share_pct', 100, 'is_primary', true))));
  return v_sale.id;
end $$;

-- ---------------------------------------------------------------- per started month
select pg_temp.login('manager@waystar.test');
select lives_ok($$ select pg_temp.book(1) $$, 'a plot can be booked with the down payment already due');

-- one day late is one started month: 10% of 3,000,000
select is((select late_fee from public.installments i join public.sales s on s.id = i.sale_id
           where s.unit_id = (select unit_id from (select u.id as unit_id from public.units u
             where u.project_id = (select sv from t) and u.status = 'booked' order by u.unit_no desc limit 1) z)
             and i.seq = 1),
          300000.00::numeric, 'one day late charges one whole month: 10% of the down payment');
select pg_temp.logout();

-- clear the way for the next scenario
select pg_temp.login('admin@waystar.test');
update public.sales set status = 'cancelled' where booking_form_no like 'SV-BF-%'
  and booking_date = (select today from t) - 1;
select pg_temp.logout();

-- 40 days late is two started months
select pg_temp.login('manager@waystar.test');
select lives_ok($$ select pg_temp.book(40) $$, 'a second plot can be booked 40 days back');
create temp table s2 as select id, unit_id from public.sales where booking_date = (select today from t) - 40 limit 1;
grant select on s2 to authenticated;
select is((select late_fee from public.installments where sale_id = (select id from s2) and seq = 1),
          600000.00::numeric, '40 days late charges two whole months');
select is((select days_overdue from public.installments where sale_id = (select id from s2) and seq = 1),
          40, 'the days overdue are counted exactly');
select pg_temp.logout();

-- ---------------------------------------------------------------- installment before penalty
select pg_temp.login('accounts@waystar.test');
-- the down payment is 3,000,000 with 600,000 of penalty on top; pay 3,200,000
select lives_ok($$ select public.record_payment(jsonb_build_object(
    'sale_id', (select id from s2), 'received_on', (select today from t),
    'amount', 3200000, 'mode', 'cash')) $$, 'a part payment can be recorded');

select is((select amount_paid from public.installments where sale_id = (select id from s2) and seq = 1),
          3000000.00::numeric, 'the installment itself is settled first, in full');
select is((select late_fee_paid from public.installments where sale_id = (select id from s2) and seq = 1),
          200000.00::numeric, 'only what is left over goes to the penalty');
select is((select status from public.installments where sale_id = (select id from s2) and seq = 1),
          'partially_paid'::public.installment_status, 'it is not "paid" while penalty is still owing');

-- the penalty already incurred does not disappear once the installment is settled
select is((select late_fee from public.installments where sale_id = (select id from s2) and seq = 1),
          600000.00::numeric, 'a penalty already incurred is not wiped by paying the installment');

-- the unit is sold: the down payment itself has cleared
select is((select status from public.units where id = (select unit_id from s2)),
          'sold'::public.unit_status, 'the plot is sold once the down payment clears, penalty aside');

-- paying the rest settles the penalty and closes the installment
select lives_ok($$ select public.record_payment(jsonb_build_object(
    'sale_id', (select id from s2), 'received_on', (select today from t),
    'amount', 400000, 'mode', 'cash')) $$, 'the remaining penalty can be paid');
select is((select status from public.installments where sale_id = (select id from s2) and seq = 1),
          'paid'::public.installment_status, 'once the penalty is paid too, the installment is closed');
select pg_temp.logout();

-- ---------------------------------------------------------------- down payment balance due at once
select pg_temp.login('admin@waystar.test');
update public.sales set status = 'cancelled' where id = (select id from s2);
select pg_temp.logout();

select pg_temp.login('manager@waystar.test');
select lives_ok($$ select pg_temp.book(0, 10000000, 500000) $$, 'a plot can be booked with a part booking amount');
create temp table s3 as select id from public.sales where booking_date = (select today from t)
  and booking_form_no like 'SV-BF-%' order by created_at desc limit 1;
grant select on s3 to authenticated;
select is((select count(*)::int from public.installments where sale_id = (select id from s3) and type = 'down_payment'),
          2, 'the down payment splits into the booking amount and its balance');
select is((select due_date from public.installments where sale_id = (select id from s3) and seq = 2),
          (select today from t), 'the balance of the down payment is due at once');
select pg_temp.logout();

-- ---------------------------------------------------------------- full-payment discount
select pg_temp.login('admin@waystar.test');
update public.sales set status = 'cancelled' where id = (select id from s3);
select pg_temp.logout();

select pg_temp.login('agent@waystar.test');
-- 5% is company policy, so an agent may apply it without a Manager
select lives_ok($$ select pg_temp.book(0, 10000000, null, 'full_cash', 500000) $$,
                'an agent can apply the standard 5% full-payment discount');
select pg_temp.logout();
select pg_temp.login('admin@waystar.test');
update public.sales set status = 'cancelled' where booking_form_no like 'SV-BF-%'
  and plan_kind = 'full_cash' and discount = 500000;
select pg_temp.logout();

select pg_temp.login('agent@waystar.test');
-- anything beyond it is a negotiated discount and still needs a Manager
select throws_ok($$ select pg_temp.book(0, 10000000, null, 'full_cash', 1000000) $$,
                 '42501', null, 'a 10% discount still needs a Manager');
select pg_temp.logout();

-- a back-dated booking whose payment was made on time must carry no penalty at all:
-- the penalty follows the date the money arrived, not the date it was typed in
select pg_temp.login('manager@waystar.test');
select lives_ok($$ select pg_temp.book(300) $$, 'a booking can be entered 300 days after the fact');
create temp table s4 as select id from public.sales where booking_date = (select today from t) - 300 limit 1;
grant select on s4 to authenticated;
select pg_temp.logout();

select pg_temp.login('accounts@waystar.test');
select lives_ok($$ select public.record_payment(jsonb_build_object(
    'sale_id', (select id from s4), 'received_on', (select today from t) - 300,
    'amount', 3000000, 'mode', 'cash')) $$, 'its historical payment can be entered');
select pg_temp.logout();

select is((select late_fee from public.installments where sale_id = (select id from s4) and seq = 1),
          0.00::numeric, 'a payment made on the due date carries no penalty, however late it is entered');
select is((select status from public.installments where sale_id = (select id from s4) and seq = 1),
          'paid'::public.installment_status, 'and the installment is simply paid');

select * from finish();
rollback;
