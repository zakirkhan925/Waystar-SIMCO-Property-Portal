-- Phase 1: inventory summary per project (RLS of the caller applies via security_invoker)

create view public.v_project_inventory with (security_invoker = true) as
select
  p.id   as project_id,
  p.name,
  p.code,
  p.type,
  p.status as project_status,
  p.sort_order,
  count(u.id)::int                                         as total_units,
  count(u.id) filter (where u.status = 'available')::int   as available,
  count(u.id) filter (where u.status = 'on_hold')::int     as on_hold,
  count(u.id) filter (where u.status = 'booked')::int      as booked,
  count(u.id) filter (where u.status = 'sold')::int        as sold,
  count(u.id) filter (where u.status = 'rented')::int      as rented,
  count(u.id) filter (where u.status = 'blocked')::int     as blocked,
  coalesce(sum(u.base_price), 0)::numeric(16,2)            as total_list_value,
  coalesce(sum(u.base_price) filter (where u.status in ('available','on_hold')), 0)::numeric(16,2)
                                                           as unsold_inventory_value,
  coalesce(sum(u.area_sqft), 0)::numeric(16,2)             as total_area_sqft
from public.projects p
left join public.units u on u.project_id = p.id and u.deleted_at is null
where p.deleted_at is null
group by p.id;

grant select on public.v_project_inventory to authenticated;
revoke all on public.v_project_inventory from anon;

-- Global search across units and clients (RLS applies: security invoker).
create or replace function public.global_search(p_q text, p_limit int default 8)
returns table (kind text, id uuid, title text, subtitle text, project_id uuid)
language sql stable security invoker set search_path = '' as $$
  with q as (select trim(p_q) as t, regexp_replace(p_q, '\D', '', 'g') as digits)
  (select 'unit', u.id,
          coalesce(b.name || ' · ', '') || coalesce(u.street || ' · ', '') || u.unit_no,
          pr.name || ' · ' || u.category::text || ' · ' || u.status::text,
          u.project_id
   from public.units u
   join public.projects pr on pr.id = u.project_id
   left join public.blocks b on b.id = u.block_id
   cross join q
   where u.deleted_at is null and length(q.t) >= 1 and u.unit_no ilike q.t || '%'
   order by pr.sort_order, u.unit_no
   limit p_limit)
  union all
  (select 'client', c.id, c.full_name,
          coalesce(c.cnic, c.passport_no) || ' · ' || c.phone,
          null::uuid
   from public.clients c cross join q
   where c.deleted_at is null and length(q.t) >= 2 and (
         c.full_name ilike '%' || q.t || '%'
      or (length(q.digits) >= 4 and (replace(coalesce(c.cnic,''), '-', '') like q.digits || '%'
                                     or regexp_replace(c.phone, '\D', '', 'g') like '%' || q.digits || '%'))
      or upper(coalesce(c.passport_no,'')) = upper(q.t))
   order by c.full_name
   limit p_limit)
$$;
revoke execute on function public.global_search(text, int) from anon, public;
grant execute on function public.global_search(text, int) to authenticated;
