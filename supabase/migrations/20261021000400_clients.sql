-- Phase 1: clients (owners / buyers / tenants) and external dealers

create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null check (length(trim(full_name)) >= 2),
  relation_type   text check (relation_type in ('s/o','d/o','w/o')),
  guardian_name   text,                          -- father / husband name
  cnic            text check (cnic ~ '^\d{5}-\d{7}-\d$'),
  passport_no     text,
  nationality     text not null default 'Pakistani',
  is_overseas     boolean not null default false,
  phone           text not null check (phone ~ '^\+?[0-9 -]{7,20}$'),
  whatsapp        text check (whatsapp ~ '^\+?[0-9 -]{7,20}$'),
  email           text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address         text,
  city            text,
  country         text not null default 'Pakistan',
  nok_name        text,
  nok_cnic        text check (nok_cnic ~ '^\d{5}-\d{7}-\d$'),
  nok_relation    text,
  nok_phone       text,
  photo_path      text,
  cnic_front_path text,
  cnic_back_path  text,
  auth_user_id    uuid unique references auth.users(id) on delete set null,  -- future client portal
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid() references public.profiles(id),
  deleted_at      timestamptz,
  constraint clients_identity check (cnic is not null or passport_no is not null)
);
create unique index clients_cnic_uq     on public.clients (cnic) where cnic is not null and deleted_at is null;
create unique index clients_passport_uq on public.clients (upper(passport_no)) where passport_no is not null and deleted_at is null;
create index clients_phone_idx      on public.clients (phone);
create index clients_created_by_idx on public.clients (created_by);
create index clients_name_trgm      on public.clients using gin (full_name extensions.gin_trgm_ops);
create trigger clients_touch before update on public.clients
  for each row execute function private.touch_updated_at();

create or replace function private.my_client_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select c.id from public.clients c where c.auth_user_id = auth.uid() and c.deleted_at is null
$$;

-- Lets agents check for an existing client by CNIC/passport without exposing other agents' clients.
create or replace function public.client_exists(p_cnic text default null, p_passport text default null)
returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_staff() and exists (
    select 1 from public.clients c
    where c.deleted_at is null
      and ((p_cnic is not null and c.cnic = p_cnic)
        or (p_passport is not null and upper(c.passport_no) = upper(p_passport))))
$$;
revoke execute on function public.client_exists(text, text) from anon, public;
grant execute on function public.client_exists(text, text) to authenticated;

create table public.dealers (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  agency                 text,
  phone                  text,
  cnic                   text check (cnic ~ '^\d{5}-\d{7}-\d$'),
  email                  text,
  default_commission_pct numeric(5,2) check (default_commission_pct between 0 and 100),
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid default auth.uid() references public.profiles(id),
  deleted_at             timestamptz
);
create trigger dealers_touch before update on public.dealers
  for each row execute function private.touch_updated_at();

grant execute on all functions in schema private to authenticated, service_role;
