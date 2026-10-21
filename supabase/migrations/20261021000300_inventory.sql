-- Phase 1: projects, project access, blocks/towers, floors, units

create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  code             text not null check (code ~ '^[A-Z0-9]{2,6}$'),
  type             public.project_type not null,
  status           public.project_status not null default 'under_construction',
  location         text,
  description      text,
  cover_image_path text,
  logo_path        text,
  sqft_per_marla   numeric(8,2) not null default 225.00 check (sqft_per_marla > 0),
  marla_per_kanal  numeric(5,2) not null default 20 check (marla_per_kanal > 0),
  -- late-payment penalty on installments (rate still to be confirmed by the client)
  late_fee_method     public.late_fee_method not null default 'none',
  late_fee_rate       numeric(10,2) not null default 0 check (late_fee_rate >= 0),
  late_fee_grace_days smallint not null default 0 check (late_fee_grace_days >= 0),
  late_fee_cap_pct    numeric(5,2) check (late_fee_cap_pct between 0 and 100),
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references public.profiles(id),
  deleted_at       timestamptz
);
create unique index projects_code_uq on public.projects (code) where deleted_at is null;
create trigger projects_touch before update on public.projects
  for each row execute function private.touch_updated_at();

create table public.user_project_access (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);
create index user_project_access_project_idx on public.user_project_access (project_id);

-- Super Admin & Manager see every project; everyone else only what they're granted.
create or replace function private.can_access_project(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('super_admin','manager')
      or (private.is_staff() and exists (
            select 1 from public.user_project_access a
            where a.user_id = auth.uid() and a.project_id = p))
$$;

create table public.blocks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id),
  name        text not null,
  kind        public.block_kind not null default 'block',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references public.profiles(id),
  deleted_at  timestamptz
);
create unique index blocks_name_uq on public.blocks (project_id, lower(name)) where deleted_at is null;
create trigger blocks_touch before update on public.blocks
  for each row execute function private.touch_updated_at();

create table public.floors (
  id          uuid primary key default gen_random_uuid(),
  block_id    uuid not null references public.blocks(id),
  label       text not null,             -- Basement, Ground, Mezzanine, 1st ... nth
  level       int  not null,             -- -1 basement, 0 ground, 1..n
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references public.profiles(id),
  deleted_at  timestamptz
);
create unique index floors_label_uq on public.floors (block_id, lower(label)) where deleted_at is null;
create index floors_block_idx on public.floors (block_id, level);
create trigger floors_touch before update on public.floors
  for each row execute function private.touch_updated_at();

create table public.units (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id),
  block_id          uuid references public.blocks(id),
  floor_id          uuid references public.floors(id),   -- null for plots
  street            text,                                -- plots only
  unit_no           text not null,
  category          public.unit_category not null,
  use               public.unit_use not null,
  size_value        numeric(10,2) not null check (size_value > 0),
  size_unit         public.size_unit not null,
  area_sqft         numeric(12,2) not null default 0,    -- normalized by trigger
  bedrooms          smallint check (bedrooms >= 0),
  bathrooms         smallint check (bathrooms >= 0),
  is_corner         boolean not null default false,
  is_park_facing    boolean not null default false,
  is_main_boulevard boolean not null default false,
  base_price        numeric(14,2) not null check (base_price >= 0),
  price_per_sqft    numeric(14,2) check (price_per_sqft >= 0),
  status            public.unit_status not null default 'available',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid default auth.uid() references public.profiles(id),
  deleted_at        timestamptz,
  constraint units_floor_needs_block check (floor_id is null or block_id is not null)
);
create unique index units_no_uq on public.units
  (project_id, coalesce(block_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(coalesce(street, '')), lower(unit_no))
  where deleted_at is null;
create index units_project_status_idx on public.units (project_id, status) where deleted_at is null;
create index units_block_idx    on public.units (block_id);
create index units_floor_idx    on public.units (floor_id);
create index units_category_idx on public.units (category);
create index units_unit_no_trgm on public.units using gin (unit_no extensions.gin_trgm_ops);
create trigger units_touch before update on public.units
  for each row execute function private.touch_updated_at();

-- Normalize area, default price/sqft, and keep block/floor consistent with project.
create or replace function private.units_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_marla numeric; v_kanal numeric;
begin
  select p.sqft_per_marla, p.marla_per_kanal into v_marla, v_kanal
  from public.projects p where p.id = new.project_id;

  new.area_sqft := round(case new.size_unit
                           when 'sqft'  then new.size_value
                           when 'marla' then new.size_value * v_marla
                           when 'kanal' then new.size_value * v_kanal * v_marla
                         end, 2);

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
create trigger units_before_write before insert or update on public.units
  for each row execute function private.units_before_write();

-- booked / sold / rented are driven by sales & leases (Phase 2+). Users may only
-- toggle between available / on_hold / blocked, and only while the unit is free.
create or replace function private.guard_unit_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('app.system_status', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('available','on_hold','blocked') then
      raise exception 'New units must be available, on hold or blocked';
    end if;
  elsif new.status is distinct from old.status then
    if old.status not in ('available','on_hold','blocked')
       or new.status not in ('available','on_hold','blocked') then
      raise exception 'Unit status % -> % is set automatically by sales/leases', old.status, new.status
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger units_guard_status before insert or update of status on public.units
  for each row execute function private.guard_unit_status();

grant execute on all functions in schema private to authenticated, service_role;
