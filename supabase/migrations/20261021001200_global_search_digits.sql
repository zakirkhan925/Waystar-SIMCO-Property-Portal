-- Global search: match CNIC/phone on the digits-only column, ignoring a leading 0
-- so "0300 1234567" finds "+92 300 1234567".
create or replace function public.global_search(p_q text, p_limit int default 8)
returns table (kind text, id uuid, title text, subtitle text, project_id uuid)
language sql stable security invoker set search_path = '' as $$
  with q as (select trim(p_q) as t, ltrim(regexp_replace(p_q, '\D', '', 'g'), '0') as digits)
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
      or (length(q.digits) >= 4 and c.search_digits like '%' || q.digits || '%')
      or upper(coalesce(c.passport_no, '')) = upper(q.t))
   order by c.full_name
   limit p_limit)
$$;
