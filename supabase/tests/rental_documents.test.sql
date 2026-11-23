begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create temp table fixture as
select u.id as unit_id, u.project_id,
  (select id from public.clients where cnic = '61101-7788990-8') as tenant_id,
  null::uuid as lease_id, null::uuid as payment_id, null::uuid as invoice_id,
  null::text as lease_no, null::text as receipt_no, null::text as invoice_no,
  null::text as lease_token, null::text as receipt_token, null::text as invoice_token
from public.units u join public.projects p on p.id = u.project_id and p.code = 'SV'
where u.status = 'available' order by u.id limit 1;
grant select, update on fixture to authenticated;
grant select on fixture to anon;

create function pg_temp.issue(p_type text, p_ref text) returns text language sql as $$
  select public.issue_document(jsonb_build_object(
    'doc_type', p_type, 'ref_no', p_ref,
    'project_id', project_id, 'lease_id', lease_id,
    'rent_payment_id', payment_id, 'rent_invoice_id', invoice_id))
  from fixture
$$;

select pg_temp.login('admin@waystar.test');
update fixture set lease_id = (public.create_lease(jsonb_build_object(
  'unit_id', unit_id, 'tenant_client_id', tenant_id, 'monthly_rent', 50000,
  'start_date', (now() at time zone 'Asia/Karachi')::date, 'end_date', (now() at time zone 'Asia/Karachi')::date + 90
))).id;
update fixture f set lease_no = l.agreement_no from public.leases l where f.lease_id = l.id;
update fixture f set (invoice_id, invoice_no) = (select id, invoice_no from public.rent_invoices where lease_id = f.lease_id);
update fixture set payment_id = (public.record_rent_payment(jsonb_build_object(
  'lease_id', lease_id, 'mode', 'cash', 'amount', 50000, 'received_on', current_date))).id;
update fixture f set receipt_no = p.receipt_no from public.rent_payments p where f.payment_id = p.id;

update fixture set lease_token = pg_temp.issue('lease_agreement', lease_no),
  receipt_token = pg_temp.issue('rent_receipt', receipt_no),
  invoice_token = pg_temp.issue('rent_invoice', invoice_no);

select is(pg_temp.issue('rent_receipt', receipt_no), receipt_token, 'reprinting the receipt retains its token') from fixture;
select throws_ok($$ select pg_temp.issue('rent_invoice','FAKE') $$, '22023', null, 'invoice reference is tied to source');

reset role;
select pg_temp.login('agent@waystar.test');
select throws_ok($$ select pg_temp.issue('lease_agreement', lease_no) from fixture $$, '42501', null, 'unassigned agent cannot issue lease');
select is((select count(*) from public.issued_documents where lease_id = (select lease_id from fixture)),
  0::bigint, 'unassigned agent cannot read issued rental rows');

reset role;
set local role anon;
select is(public.verify_document(receipt_token)->>'document_type', 'Rent Receipt', 'anon verifies receipt') from fixture;
select is(public.verify_document(invoice_token)->>'document_type', 'Rent Invoice', 'anon verifies invoice') from fixture;
select is(public.verify_document(lease_token)->>'document_type', 'Lease Summary', 'anon verifies lease') from fixture;
select is(public.verify_document(receipt_token)->>'amount', '50000.00', 'receipt verification shows the receipt amount') from fixture;
select ok(not (public.verify_document(invoice_token) ?| array['amount','cnic','phone','address','outstanding']),
  'invoice verification excludes financial and personal details') from fixture;
select ok((public.verify_document(lease_token)->>'tenant_name') ~ '^[^ ]+( [^ ]\.)?$',
  'tenant surname is masked') from fixture;
select throws_ok($$ select * from public.issued_documents $$, '42501', null, 'anon cannot read documents directly');

reset role;
select pg_temp.login('admin@waystar.test');
select public.reverse_rent_payment(payment_id, 'Test reversal') from fixture;
select is(public.verify_document(receipt_token)->>'status', 'reversed', 'receipt updates after payment reversal') from fixture;
select public.terminate_lease(lease_id, (now() at time zone 'Asia/Karachi')::date, 'Test lease termination') from fixture;
select is(public.verify_document(lease_token)->>'status', 'terminated', 'lease verification updates after termination') from fixture;

select * from finish();
rollback;
