begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Simco Square in the seed: one tower, several floors, at least one unit that is not free.
create temp table rate_fixture as
select '10000000-0000-4000-a000-000000000002'::uuid as project_id,
       (select f.id from public.floors f join public.blocks b on b.id = f.block_id
         where b.project_id = '10000000-0000-4000-a000-000000000002' and f.deleted_at is null
           and exists (select 1 from public.units u where u.floor_id = f.id and u.deleted_at is null
                         and u.status in ('available', 'on_hold', 'blocked'))
         order by f.level limit 1) as floor_id;
create temp table not_free as
select id, base_price from public.units
where project_id = '10000000-0000-4000-a000-000000000002' and deleted_at is null
  and status not in ('available', 'on_hold', 'blocked');
create temp table free_before as
select sum(base_price) as total from public.units
where project_id = '10000000-0000-4000-a000-000000000002' and deleted_at is null;
grant select on rate_fixture, not_free, free_before to authenticated;

-- Manager
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select id from auth.users where email = 'manager@waystar.test'), 'role', 'authenticated'
)::text, true);
set local role authenticated;

select ok((select (public.set_unit_rate(project_id, 10000, p_dry_run => true)->>'units')::int > 0 from rate_fixture),
          'a dry run counts the free units');
select is((select sum(base_price) from public.units
            where project_id = '10000000-0000-4000-a000-000000000002' and deleted_at is null),
          (select total from free_before), 'a dry run changes nothing');

select lives_ok($$ select public.set_unit_rate(project_id, 45000.50, p_floor_id => floor_id, p_reason => 'test list')
                   from rate_fixture $$, 'a manager can price a floor');
select is((select count(*)::int from public.units u, rate_fixture r
            where u.floor_id = r.floor_id and u.deleted_at is null and u.status in ('available', 'on_hold', 'blocked')
              and (u.base_price <> round(u.area_sqft * 45000.50, 0) or u.price_per_sqft <> 45000.50)),
          0, 'base price = area x rate, rounded to whole rupees, and the rate is stored');

select lives_ok($$ select public.set_unit_rate(project_id, 20000) from rate_fixture $$, 'a manager can price a whole project');
select is((select count(*)::int from not_free n join public.units u using (id) where u.base_price <> n.base_price),
          0, 'booked / sold / rented units keep their price');

select throws_ok($$ select public.set_unit_rate(project_id, 0) from rate_fixture $$,
                 '22023', 'Enter a rate per sq ft greater than zero', 'a zero rate is refused');

-- Viewer
reset role;
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', (select id from auth.users where email = 'viewer@waystar.test'), 'role', 'authenticated'
)::text, true);
set local role authenticated;
select throws_ok($$ select public.set_unit_rate(project_id, 1000, p_dry_run => true) from rate_fixture $$,
                 '42501', 'Only a Super Admin or Manager can set unit prices', 'a viewer cannot set prices');

-- Not logged in
reset role;
set local role anon;
select throws_ok($$ select public.set_unit_rate('10000000-0000-4000-a000-000000000002', 1000) $$,
                 '42501', null, 'anon cannot call it');

select * from finish();
rollback;
