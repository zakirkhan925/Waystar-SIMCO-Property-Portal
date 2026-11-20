begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create temp table verification_fixture as
select jsonb_build_object('doc_type', 'payment_receipt', 'ref_no', p.receipt_no,
         'payment_id', p.id, 'sale_id', s.id, 'project_id', s.project_id) as payload,
       s.id as sale_id, p.amount::text as amount, null::text as token
from public.payments p join public.sales s on s.id = p.sale_id
where s.status <> 'cancelled' and p.status = 'valid' and p.instrument_status <> 'bounced'
order by p.receipt_no limit 1;

grant select, update on verification_fixture to authenticated;
grant select on verification_fixture to anon;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select id from auth.users where email = 'admin@waystar.test'), 'role', 'authenticated'
)::text, true);
set local role authenticated;

update verification_fixture set token = public.issue_document(payload);
select matches((select token from verification_fixture), '^[0-9a-f]{32}$', 'staff can issue a token');
select is((select public.issue_document(payload) from verification_fixture),
          (select token from verification_fixture), 'a reprint reuses the token');
select throws_ok(
  $$ select public.issue_document(payload || '{"ref_no":"made-up"}') from verification_fixture $$,
  '22023', 'Invalid document reference', 'issuance checks the reference against the source record');
select throws_ok(
  $$ select public.issue_document(payload || '{"project_id":"00000000-0000-4000-a000-000000000000"}') from verification_fixture $$,
  '42501', 'Not permitted to issue this document', 'issuance checks that the sale belongs to the project');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select public.verify_document(token)->>'status' from verification_fixture),
          'valid', 'anon can verify a token');
select is((select public.verify_document(token)->>'amount' from verification_fixture),
          (select amount from verification_fixture), 'anon can see the receipt amount');
select is(
  (select array_agg(k order by k) from verification_fixture,
   lateral jsonb_object_keys(public.verify_document(token)) as keys(k)),
  array['amount', 'buyer_name', 'document_type', 'issued_on', 'plot_no', 'project_name', 'ref_no', 'status'],
  'verification exposes only the approved fields');
select throws_ok($$ select * from public.issued_documents $$,
                 '42501', 'permission denied for table issued_documents', 'anon cannot read issued documents');
select ok(not has_function_privilege('anon', 'public.issue_document(jsonb)', 'execute'),
          'anon cannot issue documents');
select is(public.verify_document('00000000000000000000000000000000'), null::jsonb, 'unknown token returns null');

reset role;
update public.sales set status = 'cancelled' where id = (select sale_id from verification_fixture);
set local role anon;
select is((select public.verify_document(token)->>'status' from verification_fixture),
          'cancelled', 'verification reads the current sale status');

select * from finish();
rollback;
