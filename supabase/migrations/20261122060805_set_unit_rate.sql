-- Price many units at once from a rate per sq ft (e.g. "every shop on the Ground floor at Rs 45,000").
-- base_price = area_sqft x rate, rounded to whole rupees; price_per_sqft = rate.
-- Only free units are repriced (available / on hold / blocked). Booked, sold and rented units keep
-- the price they were sold at. cash_price (a separately published Full Payment price) is left alone.
--
-- p_dry_run = true only counts what would change, so the UI can show a preview before saving.
create or replace function public.set_unit_rate(
  p_project_id uuid,
  p_rate       numeric,
  p_block_id   uuid default null,
  p_floor_id   uuid default null,
  p_category   public.unit_category default null,
  p_reason     text default null,
  p_dry_run    boolean default false
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_units   integer;
  v_total   numeric;
  v_skipped integer;
begin
  if not private.has_role('super_admin', 'manager') or not private.can_access_project(p_project_id) then
    raise exception 'Only a Super Admin or Manager can set unit prices' using errcode = '42501';
  end if;
  if p_rate is null or p_rate <= 0 then
    raise exception 'Enter a rate per sq ft greater than zero' using errcode = '22023';
  end if;

  select count(*) filter (where u.status in ('available', 'on_hold', 'blocked') and u.area_sqft > 0),
         coalesce(sum(round(u.area_sqft * p_rate, 0))
                    filter (where u.status in ('available', 'on_hold', 'blocked') and u.area_sqft > 0), 0),
         count(*) filter (where u.status not in ('available', 'on_hold', 'blocked'))
    into v_units, v_total, v_skipped
  from public.units u
  where u.project_id = p_project_id
    and u.deleted_at is null
    and (p_block_id is null or u.block_id = p_block_id)
    and (p_floor_id is null or u.floor_id = p_floor_id)
    and (p_category is null or u.category = p_category);

  if not p_dry_run and v_units > 0 then
    perform set_config('app.reason',
      left(coalesce(nullif(trim(p_reason), ''), 'Rate set to Rs ' || p_rate::text || ' per sq ft'), 500), true);

    update public.units u
    set base_price = round(u.area_sqft * p_rate, 0),
        price_per_sqft = p_rate
    where u.project_id = p_project_id
      and u.deleted_at is null
      and u.status in ('available', 'on_hold', 'blocked')
      and u.area_sqft > 0
      and (p_block_id is null or u.block_id = p_block_id)
      and (p_floor_id is null or u.floor_id = p_floor_id)
      and (p_category is null or u.category = p_category);
  end if;

  return jsonb_build_object(
    'units', v_units,
    'total_value', v_total::text,
    'skipped_sold', v_skipped
  );
end $$;

revoke execute on function public.set_unit_rate(uuid, numeric, uuid, uuid, public.unit_category, text, boolean)
  from public, anon, authenticated;
grant execute on function public.set_unit_rate(uuid, numeric, uuid, uuid, public.unit_category, text, boolean)
  to authenticated;
