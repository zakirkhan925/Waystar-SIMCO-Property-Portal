-- Phase 1: update helpers that record an audit reason in the same transaction.
-- SECURITY INVOKER: the caller's RLS still decides whether the update is allowed.

create or replace function public.update_unit(p_id uuid, p_patch jsonb, p_reason text default null)
returns public.units
language plpgsql security invoker set search_path = '' as $$
declare
  v_row public.units;
begin
  if p_reason is not null and length(trim(p_reason)) > 0 then
    perform set_config('app.reason', left(trim(p_reason), 500), true);
  end if;

  update public.units u set
    block_id          = case when p_patch ? 'block_id'          then nullif(p_patch->>'block_id','')::uuid       else u.block_id end,
    floor_id          = case when p_patch ? 'floor_id'          then nullif(p_patch->>'floor_id','')::uuid       else u.floor_id end,
    street            = case when p_patch ? 'street'            then nullif(p_patch->>'street','')               else u.street end,
    unit_no           = case when p_patch ? 'unit_no'           then p_patch->>'unit_no'                         else u.unit_no end,
    category          = case when p_patch ? 'category'          then (p_patch->>'category')::public.unit_category else u.category end,
    use               = case when p_patch ? 'use'               then (p_patch->>'use')::public.unit_use          else u.use end,
    size_value        = case when p_patch ? 'size_value'        then (p_patch->>'size_value')::numeric           else u.size_value end,
    size_unit         = case when p_patch ? 'size_unit'         then (p_patch->>'size_unit')::public.size_unit   else u.size_unit end,
    bedrooms          = case when p_patch ? 'bedrooms'          then nullif(p_patch->>'bedrooms','')::smallint   else u.bedrooms end,
    bathrooms         = case when p_patch ? 'bathrooms'         then nullif(p_patch->>'bathrooms','')::smallint  else u.bathrooms end,
    is_corner         = case when p_patch ? 'is_corner'         then (p_patch->>'is_corner')::boolean            else u.is_corner end,
    is_park_facing    = case when p_patch ? 'is_park_facing'    then (p_patch->>'is_park_facing')::boolean       else u.is_park_facing end,
    is_main_boulevard = case when p_patch ? 'is_main_boulevard' then (p_patch->>'is_main_boulevard')::boolean    else u.is_main_boulevard end,
    base_price        = case when p_patch ? 'base_price'        then (p_patch->>'base_price')::numeric           else u.base_price end,
    price_per_sqft    = case when p_patch ? 'price_per_sqft'    then nullif(p_patch->>'price_per_sqft','')::numeric else u.price_per_sqft end,
    status            = case when p_patch ? 'status'            then (p_patch->>'status')::public.unit_status    else u.status end,
    notes             = case when p_patch ? 'notes'             then nullif(p_patch->>'notes','')                else u.notes end
  where u.id = p_id and u.deleted_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Unit not found or you do not have permission to edit it' using errcode = '42501';
  end if;
  return v_row;
end $$;

revoke execute on function public.update_unit(uuid, jsonb, text) from anon, public;
grant execute on function public.update_unit(uuid, jsonb, text) to authenticated;

-- Soft delete with a mandatory reason (Super Admin only — enforced by the guard trigger + RLS)
create or replace function public.soft_delete(p_table text, p_id uuid, p_reason text)
returns void
language plpgsql security invoker set search_path = '' as $$
declare n int;
begin
  if p_table not in ('projects','blocks','floors','units','clients','dealers') then
    raise exception 'Soft delete is not supported for %', p_table;
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'A reason is required';
  end if;
  perform set_config('app.reason', left(trim(p_reason), 500), true);
  execute format('update public.%I set deleted_at = now() where id = $1 and deleted_at is null', p_table) using p_id;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Record not found or you do not have permission to delete it' using errcode = '42501';
  end if;
end $$;

revoke execute on function public.soft_delete(text, uuid, text) from anon, public;
grant execute on function public.soft_delete(text, uuid, text) to authenticated;
