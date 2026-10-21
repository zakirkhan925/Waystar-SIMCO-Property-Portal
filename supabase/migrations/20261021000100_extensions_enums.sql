-- Phase 1: extensions, private schema, shared enums and helpers

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- Helper functions used by RLS live here; this schema is NOT exposed through the API.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create type public.app_role       as enum ('super_admin','manager','sales_agent','accounts','viewer','client');
create type public.project_type   as enum ('plot_society','high_rise');
create type public.project_status as enum ('off_plan','under_construction','completed');
create type public.block_kind     as enum ('block','tower','phase','sector');
create type public.unit_category  as enum ('plot','apartment','shop','office','penthouse','other');
create type public.unit_use       as enum ('residential','commercial');
create type public.size_unit      as enum ('marla','kanal','sqft');
create type public.unit_status    as enum ('available','on_hold','booked','sold','rented','blocked');
create type public.late_fee_method as enum ('none','flat_per_installment','pct_of_overdue_per_month','pct_per_day');
create type public.audit_action   as enum ('insert','update','delete');

-- updated_at maintenance
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Business "today" is always Pakistan time, regardless of server timezone.
create or replace function private.today_pk() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Karachi')::date
$$;

grant execute on all functions in schema private to authenticated, service_role;
