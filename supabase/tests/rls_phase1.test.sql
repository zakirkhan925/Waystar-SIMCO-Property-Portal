-- pgTAP: Phase 1 RLS and guards. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- helper: act as a seeded user
create or replace function pg_temp.login(p_email text) returns void language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
end $$;
-- helper: run a statement as the current role and return the number of rows it touched
create or replace function pg_temp.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------- anon
set local role anon;
select throws_ok($$ select count(*) from public.units $$, '42501', null, 'anon cannot read units');
select throws_ok($$ select count(*) from public.clients $$, '42501', null, 'anon cannot read clients');
reset role;

-- ---------------------------------------------------------------- project scoping
select pg_temp.login('agent@waystar.test');
select is((select count(*)::int from public.projects), 2, 'agent sees only granted projects (2)');
select is((select count(*)::int from public.units u join public.projects p on p.id = u.project_id
           where p.code = 'MER'), 0, 'agent cannot see units in non-granted project');
select pg_temp.logout();

select pg_temp.login('manager@waystar.test');
select is((select count(*)::int from public.projects), 5, 'manager sees all projects');
select pg_temp.logout();

select pg_temp.login('viewer@waystar.test');
select is((select count(*)::int from public.projects), 5, 'viewer sees granted projects (all 5)');
select pg_temp.logout();

-- ---------------------------------------------------------------- unit writes
select pg_temp.login('agent@waystar.test');
select is(pg_temp.affected($q$ update public.units set base_price = 1 where unit_no = '101' $q$), 0,
          'agent cannot edit unit prices (0 rows updated)');
select throws_ok($$ insert into public.units (project_id, unit_no, category, use, size_value, size_unit, base_price)
                    select id, 'X-1', 'plot', 'residential', 5, 'marla', 1 from public.projects where code = 'SV' $$,
                 '42501', null, 'agent cannot create units');
select pg_temp.logout();

select pg_temp.login('viewer@waystar.test');
select is(pg_temp.affected($q$ update public.units set notes = 'x' $q$), 0, 'viewer cannot update units');
select pg_temp.logout();

select pg_temp.login('manager@waystar.test');
select lives_ok($$ update public.units set status = 'on_hold'
                   where id = (select id from public.units where status = 'available' limit 1) $$,
                'manager can put an available unit on hold');
select throws_ok($$ update public.units set status = 'sold'
                    where id = (select id from public.units where status = 'available' limit 1) $$,
                 '42501', null, 'manual status change to sold is blocked');
select throws_ok($$ update public.units set deleted_at = now()
                    where id = (select id from public.units limit 1) $$,
                 '42501', null, 'manager cannot soft-delete a unit');
select pg_temp.logout();

-- ---------------------------------------------------------------- area normalization
-- Simco Villas plots carry real dimensions: area = width x depth
select is((select area_sqft from public.units u join public.projects p on p.id = u.project_id
           where p.code = 'SV' and u.size_value = 5 and u.width_ft = 25 limit 1),
          1250.00::numeric, '5 Marla (25 x 50) = 1250 sq ft from dimensions');
-- without dimensions, marla/kanal convert at the project rate (225 sq ft/marla, 20 marla/kanal)
insert into public.units (project_id, unit_no, category, use, size_value, size_unit, base_price)
select id, 'T-K1', 'plot', 'residential', 1, 'kanal', 1 from public.projects where code = 'SV';
select is((select area_sqft from public.units where unit_no = 'T-K1'), 4500.00::numeric, '1 kanal = 4500 sq ft');

-- ---------------------------------------------------------------- clients
select pg_temp.login('agent@waystar.test');
select ok((select count(*) from public.clients) > 0, 'agent sees own clients');
select is((select count(*)::int from public.clients
           where created_by <> '00000000-0000-4000-a000-000000000003'), 0, 'agent cannot see other agents'' clients');
select ok(public.client_exists('61101-2345678-2') or public.client_exists('61101-4567890-4'),
          'agent can check CNIC existence across all clients');
select lives_ok($$ insert into public.clients (full_name, cnic, phone)
                   values ('Test Buyer', '12345-1234567-1', '+92 300 0000000') $$, 'agent can create a client');
select throws_ok($$ insert into public.clients (full_name, cnic, phone)
                    values ('Bad CNIC', '1234-1234567-1', '+92 300 0000000') $$,
                 '23514', null, 'CNIC format is validated');
select throws_ok($$ insert into public.clients (full_name, cnic, phone)
                    values ('Dup', '12345-1234567-1', '+92 300 0000001') $$,
                 '23505', null, 'duplicate CNIC rejected');
select pg_temp.logout();

select pg_temp.login('accounts@waystar.test');
select throws_ok($$ insert into public.clients (full_name, cnic, phone)
                    values ('Nope', '12345-7654321-1', '+92 300 0000000') $$,
                 '42501', null, 'accounts cannot create clients');
select pg_temp.logout();

-- ---------------------------------------------------------------- roles
select pg_temp.login('manager@waystar.test');
select throws_ok($$ update public.profiles set role = 'super_admin' where email = 'manager@waystar.test' $$,
                 '42501', null, 'manager cannot promote themselves');
select pg_temp.logout();

-- ---------------------------------------------------------------- audit
select ok((select count(*) from public.activity_log where table_name = 'clients' and action = 'insert') > 0,
          'client inserts are audited');
select pg_temp.login('agent@waystar.test');
select is((select count(*)::int from public.activity_log), 0, 'agent cannot read the activity log');
select pg_temp.logout();

select * from finish();
rollback;
