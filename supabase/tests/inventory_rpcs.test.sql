-- pgTAP: update_unit (audit reason), soft_delete, area recalculation, global_search scoping
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create or replace function pg_temp.login(p_email text) returns void language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- pick a test unit
create temp table t_unit as
  select u.id from public.units u join public.projects p on p.id = u.project_id
  where p.code = 'SV' and u.status = 'available' and u.size_unit = 'marla' order by u.unit_no limit 1;
grant select on t_unit to authenticated;

-- update_unit records the reason in the activity log
select pg_temp.login('manager@waystar.test');
select lives_ok($$ select public.update_unit((select id from t_unit), '{"base_price":"9999000"}'::jsonb, 'Price revised per circular 7') $$,
                'manager can update a unit with a reason');
select pg_temp.logout();
select is((select reason from public.activity_log where table_name = 'units' and record_id = (select id::text from t_unit)
           order by id desc limit 1), 'Price revised per circular 7', 'reason is stored in the activity log');
select is((select base_price from public.units where id = (select id from t_unit)), 9999000.00::numeric, 'price updated exactly');

-- agents cannot use update_unit to bypass RLS
select pg_temp.login('agent@waystar.test');
select throws_ok($$ select public.update_unit((select id from t_unit), '{"base_price":"1"}'::jsonb, 'x') $$,
                 '42501', null, 'agent cannot update units through the RPC');

-- global search honours project scoping: agent has no access to The Meridian
select is((select count(*)::int from public.global_search('1101') g
           join public.projects p on p.id = g.project_id where p.code = 'MER'), 0,
          'global search hides units in projects the agent cannot access');
select pg_temp.logout();

-- soft delete: manager refused, super admin allowed with reason
select pg_temp.login('manager@waystar.test');
select throws_ok($$ select public.soft_delete('units', (select id from t_unit), 'duplicate entry') $$,
                 '42501', null, 'manager cannot soft-delete');
select pg_temp.logout();
select pg_temp.login('admin@waystar.test');
select lives_ok($$ select public.soft_delete('units', (select id from t_unit), 'duplicate entry') $$, 'super admin can soft-delete');
select pg_temp.logout();

-- changing marla size recalculates areas
update public.projects set sqft_per_marla = 272.25 where code = 'SV';
select is((select area_sqft from public.units u join public.projects p on p.id = u.project_id
           where p.code = 'SV' and u.size_unit = 'marla' and u.size_value = 5 limit 1),
          1361.25::numeric, 'area recalculated when the project marla size changes');
select is((select area_sqft from public.units u join public.projects p on p.id = u.project_id
           where p.code = 'SSQ' and u.size_unit = 'sqft' limit 1) > 0, true, 'sq ft units unaffected');

select * from finish();
rollback;
