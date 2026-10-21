-- Phase 1: profiles (linked to auth.users), roles, company settings

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text,
  role        public.app_role not null default 'viewer',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so they can read profiles regardless of RLS;
-- fixed search_path to prevent hijacking.
-- ---------------------------------------------------------------------------
create or replace function private.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function private.has_role(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() = any(roles), false)
$$;

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('super_admin','manager','sales_agent','accounts','viewer')
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile. Role comes from app_metadata (only settable with the
-- service role key, i.e. by a Super Admin through the server), never user_metadata.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(coalesce(new.email,''),'@',1), 'User'),
    new.email,
    coalesce(new.phone, new.raw_user_meta_data->>'phone'),
    coalesce((new.raw_app_meta_data->>'role')::public.app_role, 'viewer')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Only a Super Admin may change role / active flag (users may edit their own name & phone).
create or replace function private.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active
      or new.id is distinct from old.id)
     and auth.uid() is not null                      -- service role / migrations bypass
     and not private.has_role('super_admin') then
    raise exception 'Only a Super Admin can change roles or deactivate users'
      using errcode = '42501';
  end if;
  -- a Super Admin cannot demote or deactivate themselves (avoid lock-out)
  if auth.uid() = old.id and (new.role <> 'super_admin' or not new.is_active)
     and old.role = 'super_admin' then
    raise exception 'You cannot remove your own Super Admin access' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile_update();

-- ---------------------------------------------------------------------------
-- Company settings (singleton row)
-- ---------------------------------------------------------------------------
create table public.company_settings (
  id              boolean primary key default true check (id),
  company_name    text not null default 'Waystar Royco Marketing',
  partner_name    text not null default 'SIMCO Developers',
  address         text,
  phone           text,
  email           text,
  website         text default 'https://waystarmarketing.com',
  logo_path       text,
  default_sale_commission_pct     numeric(5,2) not null default 5.00 check (default_sale_commission_pct between 0 and 100),
  default_lease_commission_pct    numeric(5,2) not null default 5.00 check (default_lease_commission_pct between 0 and 100),
  default_rent_increment_pct      numeric(5,2) not null default 10.00 check (default_rent_increment_pct between 0 and 100),
  discount_approval_threshold_pct numeric(5,2) not null default 0.00 check (discount_approval_threshold_pct between 0 and 100),
  updated_at      timestamptz not null default now()
);
insert into public.company_settings (id) values (true);
create trigger company_settings_touch before update on public.company_settings
  for each row execute function private.touch_updated_at();

grant execute on all functions in schema private to authenticated, service_role;
