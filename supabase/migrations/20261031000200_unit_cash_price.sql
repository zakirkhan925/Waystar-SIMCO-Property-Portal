-- SIMCO publishes TWO prices per plot: one for the Full Payment plan and a higher one
-- for the Down Payment + Installments plan. For Simco Villas (31-Oct-2026):
--
--   5 Marla (25x50)   cash 2,990,000   installment 3,400,000
--   6 Marla (30x50)   cash 3,390,000   installment 3,800,000
--   8 Marla (30x60)   cash 4,490,000   installment 4,800,000
--
-- The gap is not a fixed percentage (12.06 / 10.79 / 6.46), so it cannot be expressed as the
-- project's full_payment_discount_pct. Storing only the installment price would force every
-- cash sale to be booked as a 6-12% "discount", which trips the Manager-approval threshold on
-- every single one and buries the real price behind a discount line on the Booking Form.
--
-- So: base_price stays the standard (installment) list price, and cash_price holds the
-- Full Payment price where one is published. create_sale is unchanged — the caller still
-- passes list_price — but the UI now has a correct figure to put in front of the agent.

alter table public.units
  add column cash_price numeric(14,2) check (cash_price >= 0);

comment on column public.units.cash_price is
  'Published Full Payment price. base_price remains the installment (standard) list price. '
  'Null means no separate cash price: the full-payment discount applies to base_price instead.';

-- The price a given plan should quote.
create or replace function public.unit_list_price(p_unit uuid, p_plan_kind public.plan_kind)
returns numeric
language sql stable security invoker set search_path = '' as $$
  select case
           when p_plan_kind = 'full_cash' then coalesce(u.cash_price, u.base_price)
           else u.base_price
         end
  from public.units u where u.id = p_unit
$$;
revoke execute on function public.unit_list_price(uuid, public.plan_kind) from anon, public;
grant execute on function public.unit_list_price(uuid, public.plan_kind) to authenticated;

-- update_unit(): accept cash_price too, so the price list can be maintained in the portal.
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
    width_ft          = case when p_patch ? 'width_ft'          then nullif(p_patch->>'width_ft','')::numeric    else u.width_ft end,
    depth_ft          = case when p_patch ? 'depth_ft'          then nullif(p_patch->>'depth_ft','')::numeric    else u.depth_ft end,
    bedrooms          = case when p_patch ? 'bedrooms'          then nullif(p_patch->>'bedrooms','')::smallint   else u.bedrooms end,
    bathrooms         = case when p_patch ? 'bathrooms'         then nullif(p_patch->>'bathrooms','')::smallint  else u.bathrooms end,
    is_corner         = case when p_patch ? 'is_corner'         then (p_patch->>'is_corner')::boolean            else u.is_corner end,
    is_park_facing    = case when p_patch ? 'is_park_facing'    then (p_patch->>'is_park_facing')::boolean       else u.is_park_facing end,
    is_main_boulevard = case when p_patch ? 'is_main_boulevard' then (p_patch->>'is_main_boulevard')::boolean    else u.is_main_boulevard end,
    base_price        = case when p_patch ? 'base_price'        then (p_patch->>'base_price')::numeric           else u.base_price end,
    cash_price        = case when p_patch ? 'cash_price'        then nullif(p_patch->>'cash_price','')::numeric  else u.cash_price end,
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
