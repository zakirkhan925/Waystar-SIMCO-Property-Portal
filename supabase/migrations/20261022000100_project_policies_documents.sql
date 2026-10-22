-- Per-project policies, letter settings and editable document templates.
-- Driven by SIMCO's Simco Villas documents (docs/02-business-rules.md).

-- ---------------------------------------------------------------------------
-- 1. Plot dimensions: when width × depth are known they define the real area;
--    size_value/size_unit stay as the plot type name ("5 Marla").
-- ---------------------------------------------------------------------------
alter table public.units
  add column width_ft numeric(8,2) check (width_ft > 0),
  add column depth_ft numeric(8,2) check (depth_ft > 0),
  add constraint units_dimensions_pair check ((width_ft is null) = (depth_ft is null));

create or replace function private.units_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_marla numeric; v_kanal numeric;
begin
  select p.sqft_per_marla, p.marla_per_kanal into v_marla, v_kanal
  from public.projects p where p.id = new.project_id;

  if new.width_ft is not null and new.depth_ft is not null then
    new.area_sqft := round(new.width_ft * new.depth_ft, 2);
  else
    new.area_sqft := round(case new.size_unit
                             when 'sqft'  then new.size_value
                             when 'marla' then new.size_value * v_marla
                             when 'kanal' then new.size_value * v_kanal * v_marla
                           end, 2);
  end if;

  if new.price_per_sqft is null and new.area_sqft > 0 then
    new.price_per_sqft := round(new.base_price / new.area_sqft, 2);
  end if;

  if new.block_id is not null and not exists (
       select 1 from public.blocks b where b.id = new.block_id and b.project_id = new.project_id) then
    raise exception 'Block does not belong to this project';
  end if;
  if new.floor_id is not null and not exists (
       select 1 from public.floors f where f.id = new.floor_id and f.block_id = new.block_id) then
    raise exception 'Floor does not belong to this block/tower';
  end if;
  return new;
end $$;

-- update_unit RPC: also accept dimensions
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

-- ---------------------------------------------------------------------------
-- 2. Project policies (used by Phase 2+ logic and quoted in documents)
-- ---------------------------------------------------------------------------
alter table public.projects
  add column corner_premium_pct            numeric(5,2) not null default 0  check (corner_premium_pct between 0 and 100),
  add column cancel_after_consecutive_missed smallint    check (cancel_after_consecutive_missed between 1 and 24),
  add column cancellation_deduction_pct    numeric(5,2) check (cancellation_deduction_pct between 0 and 100),
  add column construction_min_paid_pct     numeric(5,2) check (construction_min_paid_pct between 0 and 100),
  add column full_payment_possession_charge_pct numeric(5,2) not null default 0 check (full_payment_possession_charge_pct between 0 and 100),
  add column down_payment_balance_days     smallint     check (down_payment_balance_days between 0 and 365);

comment on column public.projects.cancel_after_consecutive_missed is
  'N consecutive unpaid installments => sale flagged "cancellation due" for a Manager to confirm (never auto-cancelled)';
comment on column public.projects.down_payment_balance_days is
  'Days after booking within which the rest of the down payment (beyond the booking amount) is due';

-- ---------------------------------------------------------------------------
-- 3. Letter / agreement settings per project (blanks in SIMCO's templates)
-- ---------------------------------------------------------------------------
create table public.project_document_settings (
  project_id                 uuid primary key references public.projects(id) on delete cascade,
  display_name               text,      -- "SIMCO VILLAS"
  full_address               text,      -- "PMO Road, Taxila, District Rawalpindi"
  execution_city             text,      -- city where agreements are signed
  seller_legal_name          text not null default 'SIMCO DEVELOPERS',
  seller_legal_status        text,      -- legal status / registration no.
  seller_ntn                 text,
  seller_office_address      text,
  seller_account_title       text,      -- payee for cheques / transfers
  signatory_name             text,
  signatory_cnic             text check (signatory_cnic ~ '^\d{5}-\d{7}-\d$'),
  managing_director_name     text,
  approval_noc_ref           text,
  possession_timeline        text,      -- e.g. "31-Dec-2028" or "within 36 months of booking"
  delay_compensation_basis   text,
  refund_days_after_resale   smallint check (refund_days_after_resale between 0 and 3650),
  discrepancy_report_days    smallint check (discrepancy_report_days between 0 and 365),
  allotment_countersign_days smallint check (allotment_countersign_days between 0 and 365),
  ndc_validity_days          smallint not null default 7 check (ndc_validity_days between 1 and 365),
  dispute_window_days        smallint not null default 7 check (dispute_window_days between 1 and 365),
  marketed_by                text not null default 'Waystar Royco',
  updated_at                 timestamptz not null default now(),
  updated_by                 uuid default auth.uid() references public.profiles(id)
);
create trigger project_document_settings_touch before update on public.project_document_settings
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Editable clause templates per project + document type, versioned.
--    sections: [{ "key": "terms", "heading": "TERMS & CONDITIONS",
--                 "style": "bullets" | "numbered" | "paragraphs", "items": ["..."] }]
--    Items may use {{placeholders}} filled from settings / the deal.
-- ---------------------------------------------------------------------------
create type public.document_type as enum
  ('booking_form','allotment_letter','sale_agreement','installment_schedule','possession_letter','ndc_letter',
   'payment_receipt','transfer_letter','statement_of_account');

create table public.document_templates (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id),     -- null = default for all projects
  doc_type    public.document_type not null,
  version     int not null default 1,
  title       text not null,
  ref_prefix  text not null,                           -- BF, AL, SA, PL, NDC …
  sections    jsonb not null default '[]'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references public.profiles(id),
  constraint sections_is_array check (jsonb_typeof(sections) = 'array')
);
create unique index document_templates_version_uq
  on public.document_templates (coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), doc_type, version);
create unique index document_templates_active_uq
  on public.document_templates (coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), doc_type)
  where is_active;

-- Saving a template edit = insert a new version and deactivate the old one (history kept).
create or replace function public.save_document_template(
  p_project_id uuid, p_doc_type public.document_type, p_title text, p_ref_prefix text, p_sections jsonb, p_reason text)
returns public.document_templates
language plpgsql security invoker set search_path = '' as $$
declare
  v_next int;
  v_row public.document_templates;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'A reason is required when changing document wording';
  end if;
  perform set_config('app.reason', left(trim(p_reason), 500), true);

  select coalesce(max(version), 0) + 1 into v_next from public.document_templates
   where project_id is not distinct from p_project_id and doc_type = p_doc_type;

  update public.document_templates set is_active = false
   where project_id is not distinct from p_project_id and doc_type = p_doc_type and is_active;

  insert into public.document_templates (project_id, doc_type, version, title, ref_prefix, sections)
  values (p_project_id, p_doc_type, v_next, p_title, upper(p_ref_prefix), p_sections)
  returning * into v_row;
  return v_row;
end $$;
revoke execute on function public.save_document_template(uuid, public.document_type, text, text, jsonb, text) from anon, public;
grant execute on function public.save_document_template(uuid, public.document_type, text, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS + audit
-- ---------------------------------------------------------------------------
alter table public.project_document_settings enable row level security;
alter table public.document_templates enable row level security;

create policy pds_select on public.project_document_settings for select to authenticated
  using ((select private.can_access_project(project_id)));
create policy pds_insert on public.project_document_settings for insert to authenticated
  with check ((select private.has_role('super_admin','manager')));
create policy pds_update on public.project_document_settings for update to authenticated
  using ((select private.has_role('super_admin','manager')))
  with check ((select private.has_role('super_admin','manager')));

create policy dt_select on public.document_templates for select to authenticated
  using ((select private.is_staff()) and (project_id is null or (select private.can_access_project(project_id))));
create policy dt_insert on public.document_templates for insert to authenticated
  with check ((select private.has_role('super_admin','manager')));
create policy dt_update on public.document_templates for update to authenticated
  using ((select private.has_role('super_admin','manager')))
  with check ((select private.has_role('super_admin','manager')));

revoke all on public.project_document_settings, public.document_templates from anon;

create trigger project_document_settings_audit after insert or update or delete on public.project_document_settings
  for each row execute function private.audit_row();
create trigger document_templates_audit after insert or update or delete on public.document_templates
  for each row execute function private.audit_row();

grant execute on all functions in schema private to authenticated, service_role;

-- Audit rows for tables keyed by project_id (no id column) still get a record_id.
create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changed text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_changed
    from jsonb_each(v_new) n
    where n.key not in ('updated_at') and n.value is distinct from v_old -> n.key;
    if v_changed is null then
      return null;
    end if;
  end if;

  insert into public.activity_log (table_name, record_id, project_id, action, old_data, new_data,
                                   changed_fields, reason, changed_by)
  values (
    tg_table_name,
    coalesce(v_row->>'id', v_row->>'user_id', v_row->>'project_id'),
    case when tg_table_name = 'projects' then (v_row->>'id')::uuid
         else nullif(v_row->>'project_id','')::uuid end,
    lower(tg_op)::public.audit_action,
    v_old, v_new, v_changed,
    nullif(current_setting('app.reason', true), ''),
    auth.uid()
  );
  return null;
end $$;
