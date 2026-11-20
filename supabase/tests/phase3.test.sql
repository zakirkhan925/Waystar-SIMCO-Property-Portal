-- pgTAP: Phase 3 workflows, permissions and document revocation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

create or replace function pg_temp.login(p_email text) returns void language plpgsql as $$
declare v_id uuid;
begin
  select id into strict v_id from auth.users where email = p_email;
  perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create temp table fixture as
select u.id as unit_id, u.project_id,
       (select id from public.clients where cnic = '61101-7788990-8') as original_buyer,
       (select id from public.clients where cnic is distinct from '61101-7788990-8'
        order by id limit 1) as new_buyer,
       (select id from public.payment_plans where kind = 'installment' and project_id = u.project_id) as plan_id,
       null::uuid as sale_id, null::uuid as resale_id, null::uuid as possession_sale_id,
       null::uuid as cancellation_id, null::uuid as transfer_id, null::text as token
from public.units u join public.projects p on p.id = u.project_id and p.code = 'SV'
where u.status = 'available' and u.category = 'plot'
order by u.unit_no desc limit 1;
grant select, update on fixture to authenticated;
grant select on fixture to anon;

create or replace function pg_temp.book(p_client uuid) returns uuid language plpgsql as $$
begin
  return (public.create_sale(jsonb_build_object(
    'unit_id', (select unit_id from fixture), 'plan_kind', 'installment',
    'payment_plan_id', (select plan_id from fixture), 'list_price', 3740000,
    'booking_date', (now() at time zone 'Asia/Karachi')::date,
    'buyers', jsonb_build_array(jsonb_build_object('client_id', p_client, 'share_pct', 100, 'is_primary', true))))).id;
end $$;

create or replace function pg_temp.pay(p_sale uuid, p_amount numeric) returns uuid language plpgsql as $$
begin
  return (public.record_payment(jsonb_build_object(
    'sale_id', p_sale, 'mode', 'cash', 'amount', p_amount,
    'received_on', (now() at time zone 'Asia/Karachi')::date))).id;
end $$;

create or replace function pg_temp.transfer() returns uuid language plpgsql as $$
begin
  return (public.transfer_sale(jsonb_build_object(
    'sale_id', (select sale_id from fixture), 'reason', 'Phase 3 transfer',
    'buyers', jsonb_build_array(jsonb_build_object(
      'client_id', (select new_buyer from fixture), 'share_pct', 100, 'is_primary', true))))).id;
end $$;

create or replace function pg_temp.cancel(p_sale uuid) returns uuid language plpgsql as $$
begin
  return (public.cancel_sale(jsonb_build_object(
    'sale_id', p_sale, 'reason', 'Phase 3 cancellation', 'deduction_pct', 20))).id;
end $$;

select pg_temp.login('admin@waystar.test');
update fixture set sale_id = pg_temp.book(original_buyer);
select pg_temp.pay(sale_id, 1122000) from fixture;

reset role;
select pg_temp.login('viewer@waystar.test');
select throws_ok($$ select public.grant_possession(jsonb_build_object('sale_id', sale_id)) from fixture $$,
                 '42501', null, 'viewer cannot grant possession');
select throws_ok($$ select pg_temp.transfer() $$, '42501', null, 'viewer cannot transfer a sale');
select throws_ok($$ select pg_temp.cancel(sale_id) from fixture $$, '42501', null, 'viewer cannot cancel a sale');

reset role;
select pg_temp.login('admin@waystar.test');
update fixture set transfer_id = pg_temp.transfer();
select is((select t.sale_id from public.transfers t join fixture f on f.transfer_id = t.id),
          (select sale_id from fixture), 'transfer keeps the original sale ID');
select is((select array_agg(b.client_id) from public.sale_buyers b join fixture f on f.sale_id = b.sale_id),
          (select array[new_buyer] from fixture), 'transfer replaces the current buyers');
select is((select count(*)::int from public.unit_ownerships o join fixture f on f.sale_id = o.sale_id),
          2, 'both owners remain in ownership history');
select ok((select o.valid_to is not null from public.unit_ownerships o
           join fixture f on f.sale_id = o.sale_id and f.original_buyer = o.client_id),
          'the original ownership is closed');
select ok((select o.valid_to is null from public.unit_ownerships o
           join fixture f on f.transfer_id = o.transfer_id and f.new_buyer = o.client_id),
          'the new ownership is active and linked to the transfer');

update fixture f set token = public.issue_document(jsonb_build_object(
  'doc_type', 'transfer_letter', 'ref_no', t.transfer_no, 'sale_id', f.sale_id,
  'project_id', f.project_id, 'transfer_id', f.transfer_id))
from public.transfers t where t.id = f.transfer_id;
select is((select public.verify_document(token)->>'document_type' from fixture),
          'Transfer Letter', 'transfer verification uses the document label');
select throws_ok($$ select public.revoke_document(token, E' \t\n') from fixture $$,
                 '22023', null, 'revocation requires a reason');
reset role;
select pg_temp.login('manager@waystar.test');
select throws_ok($$ select public.revoke_document(token, 'Manager attempt') from fixture $$,
                 '42501', null, 'manager cannot revoke a document');
reset role;
select pg_temp.login('admin@waystar.test');
select lives_ok($$ select public.revoke_document(token, '  Issued in error  ') from fixture $$,
                'Super Admin can revoke with a reason');
select is((select d.revoked_reason from public.issued_documents d join fixture f on f.token = d.token),
          'Issued in error', 'revocation stores the reason');
select ok((select d.revoked_at is not null from public.issued_documents d join fixture f on f.token = d.token),
          'revocation stores a timestamp');
select ok(exists (
  select 1 from public.activity_log a join public.issued_documents d on a.record_id = d.id::text
  join fixture f on f.token = d.token
  where a.table_name = 'issued_documents' and a.action = 'update' and a.changed_by = auth.uid()
    and a.reason = 'Issued in error' and a.changed_fields @> array['revoked_at', 'revoked_reason']
), 'revocation writes the actor, reason and changed fields to the activity log');
select throws_ok($$ select public.revoke_document(token, 'A different reason') from fixture $$,
                 '22023', null, 'revoking again cannot overwrite the original audit');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select public.verify_document(token)->>'status' from fixture),
          'revoked', 'anonymous verification sees the revocation');
select ok(not has_function_privilege('anon', 'public.revoke_document(text,text)', 'execute'),
          'anonymous callers cannot execute revocation');

reset role;
select pg_temp.login('admin@waystar.test');
update fixture set cancellation_id = pg_temp.cancel(sale_id);
select is((select c.sale_price from public.cancellations c join fixture f on f.cancellation_id = c.id),
          3740000.00::numeric, 'cancellation freezes the full sale price');
select is((select c.amount_received from public.cancellations c join fixture f on f.cancellation_id = c.id),
          1122000.00::numeric, 'cancellation freezes the cleared receipts');
select is((select c.deduction_amount from public.cancellations c join fixture f on f.cancellation_id = c.id),
          748000.00::numeric, '20 percent deduction is calculated on the sale price');
select is((select c.refund_due from public.cancellations c join fixture f on f.cancellation_id = c.id),
          374000.00::numeric, 'refund subtracts the deduction from receipts');
select is((select u.status::text from public.units u join fixture f on f.unit_id = u.id),
          'available', 'cancelling makes the unit available');
select is((select c.refund_status::text from public.cancellations c join fixture f on f.cancellation_id = c.id),
          'pending_resale', 'refund waits for the re-sale');

reset role;
select pg_temp.login('viewer@waystar.test');
select throws_ok($$ select public.settle_refund(cancellation_id, current_date, 'REF-01', 'Test reason') from fixture $$,
                 '42501', null, 'viewer cannot settle an existing refund');
select throws_ok($$ select pg_temp.book(new_buyer) from fixture $$,
                 '42501', null, 'viewer cannot book a sale that fires the refund trigger');
select is((select c.refund_status::text from public.cancellations c join fixture f on f.cancellation_id = c.id),
          'pending_resale', 'the blocked re-sale leaves the refund unchanged');

reset role;
select pg_temp.login('admin@waystar.test');
update fixture set resale_id = pg_temp.book(new_buyer);
select is((select c.refund_status::text from public.cancellations c join fixture f on f.cancellation_id = c.id),
          'payable', 'the re-sale trigger makes the refund payable');
select is((select c.resold_sale_id from public.cancellations c join fixture f on f.cancellation_id = c.id),
          (select resale_id from fixture), 'the refund is linked to the new sale');
select ok((select c.refund_due_date is not null from public.cancellations c join fixture f on f.cancellation_id = c.id),
          'the re-sale sets a refund due date');

reset role;
select pg_temp.login('accounts@waystar.test');
select lives_ok($$ select public.settle_refund(cancellation_id, current_date, 'REF-01', 'Paid by bank') from fixture $$,
                'Accounts can settle a payable refund');
select is((select c.refund_status::text from public.cancellations c join fixture f on f.cancellation_id = c.id),
          'paid', 'settlement records the paid status');

reset role;
select pg_temp.login('admin@waystar.test');
select pg_temp.pay(resale_id, 500000) from fixture;
select pg_temp.cancel(resale_id) from fixture;
select is((select c.refund_due from public.cancellations c join fixture f on f.resale_id = c.sale_id),
          0.00::numeric, 'the refund floors at zero when deduction exceeds receipts');

update fixture set possession_sale_id = pg_temp.book(original_buyer);
select pg_temp.pay(possession_sale_id, 3740000) from fixture;
select lives_ok($$ select public.grant_possession(jsonb_build_object('sale_id', possession_sale_id)) from fixture $$,
                'a settled sale can receive possession');
select throws_ok($$ select public.grant_possession(jsonb_build_object('sale_id', possession_sale_id)) from fixture $$,
                 'P0001', null, 'possession cannot be granted twice');
select is((select count(*)::int from public.possessions p join fixture f on f.possession_sale_id = p.sale_id),
          1, 'only one possession record exists');

select * from finish();
rollback;
