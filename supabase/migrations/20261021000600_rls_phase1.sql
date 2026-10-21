-- Phase 1: Row Level Security.
-- Rules: no anonymous access; no hard DELETE through the API (soft delete only,
-- Super Admin); helper calls wrapped in (select ...) so Postgres evaluates them once per query.

-- Nothing in public is reachable without logging in.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- Soft delete (setting deleted_at) is a Super Admin action on every table that has it.
create or replace function private.guard_soft_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is distinct from old.deleted_at
     and auth.uid() is not null and not private.has_role('super_admin') then
    raise exception 'Only a Super Admin can delete or restore records' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['projects','blocks','floors','units','clients','dealers']
  loop
    execute format('create trigger %I before update of deleted_at on public.%I
                    for each row execute function private.guard_soft_delete()', t || '_guard_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.company_settings    enable row level security;
alter table public.projects            enable row level security;
alter table public.user_project_access enable row level security;
alter table public.blocks              enable row level security;
alter table public.floors              enable row level security;
alter table public.units               enable row level security;
alter table public.clients             enable row level security;
alter table public.dealers             enable row level security;
alter table public.activity_log        enable row level security;

-- profiles ------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.has_role('super_admin')))
  with check (id = (select auth.uid()) or (select private.has_role('super_admin')));
-- inserts come from the auth trigger; no deletes (deactivate instead)

-- company_settings ----------------------------------------------------------
create policy company_settings_select on public.company_settings for select to authenticated
  using ((select private.is_staff()));
create policy company_settings_update on public.company_settings for update to authenticated
  using ((select private.has_role('super_admin')))
  with check ((select private.has_role('super_admin')));

-- projects ------------------------------------------------------------------
create policy projects_select on public.projects for select to authenticated
  using ((select private.can_access_project(id))
         and (deleted_at is null or (select private.has_role('super_admin'))));
create policy projects_insert on public.projects for insert to authenticated
  with check ((select private.has_role('super_admin','manager')));
create policy projects_update on public.projects for update to authenticated
  using ((select private.has_role('super_admin','manager')))
  with check ((select private.has_role('super_admin','manager')));

-- user_project_access -------------------------------------------------------
create policy upa_select on public.user_project_access for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('super_admin','manager')));
create policy upa_insert on public.user_project_access for insert to authenticated
  with check ((select private.has_role('super_admin')));
create policy upa_delete on public.user_project_access for delete to authenticated
  using ((select private.has_role('super_admin')));          -- revoking access is a real delete

-- blocks --------------------------------------------------------------------
create policy blocks_select on public.blocks for select to authenticated
  using ((select private.can_access_project(project_id))
         and (deleted_at is null or (select private.has_role('super_admin'))));
create policy blocks_insert on public.blocks for insert to authenticated
  with check ((select private.has_role('super_admin','manager')));
create policy blocks_update on public.blocks for update to authenticated
  using ((select private.has_role('super_admin','manager')))
  with check ((select private.has_role('super_admin','manager')));

-- floors --------------------------------------------------------------------
create policy floors_select on public.floors for select to authenticated
  using (exists (select 1 from public.blocks b
                 where b.id = floors.block_id and (select private.can_access_project(b.project_id)))
         and (deleted_at is null or (select private.has_role('super_admin'))));
create policy floors_insert on public.floors for insert to authenticated
  with check ((select private.has_role('super_admin','manager')));
create policy floors_update on public.floors for update to authenticated
  using ((select private.has_role('super_admin','manager')))
  with check ((select private.has_role('super_admin','manager')));

-- units ---------------------------------------------------------------------
create policy units_select on public.units for select to authenticated
  using ((select private.can_access_project(project_id))
         and (deleted_at is null or (select private.has_role('super_admin'))));
create policy units_insert on public.units for insert to authenticated
  with check ((select private.has_role('super_admin','manager')));
create policy units_update on public.units for update to authenticated
  using ((select private.has_role('super_admin','manager')))
  with check ((select private.has_role('super_admin','manager')));

-- clients -------------------------------------------------------------------
-- Agents see the clients they registered (Phase 2 extends this to buyers on their sales).
create policy clients_select on public.clients for select to authenticated
  using (
    (deleted_at is null or (select private.has_role('super_admin')))
    and (
      (select private.has_role('super_admin','manager','accounts','viewer'))
      or ((select private.has_role('sales_agent')) and created_by = (select auth.uid()))
      or auth_user_id = (select auth.uid())
    ));
create policy clients_insert on public.clients for insert to authenticated
  with check (
    (select private.has_role('super_admin','manager'))
    or ((select private.has_role('sales_agent')) and created_by = (select auth.uid())));
create policy clients_update on public.clients for update to authenticated
  using (
    (select private.has_role('super_admin','manager'))
    or ((select private.has_role('sales_agent')) and created_by = (select auth.uid())))
  with check (
    (select private.has_role('super_admin','manager'))
    or ((select private.has_role('sales_agent')) and created_by = (select auth.uid())));

-- dealers -------------------------------------------------------------------
create policy dealers_select on public.dealers for select to authenticated
  using ((select private.is_staff()) and (deleted_at is null or (select private.has_role('super_admin'))));
create policy dealers_insert on public.dealers for insert to authenticated
  with check ((select private.has_role('super_admin','manager')));
create policy dealers_update on public.dealers for update to authenticated
  using ((select private.has_role('super_admin','manager')))
  with check ((select private.has_role('super_admin','manager')));

-- activity_log (read-only) --------------------------------------------------
create policy activity_log_select on public.activity_log for select to authenticated
  using ((select private.has_role('super_admin','manager','accounts','viewer'))
         and (project_id is null or (select private.can_access_project(project_id))));

-- created_by can't be spoofed on insert
create or replace function private.force_created_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['projects','blocks','floors','units','clients','dealers']
  loop
    execute format('create trigger %I before insert on public.%I
                    for each row execute function private.force_created_by()', t || '_created_by', t);
  end loop;
end $$;

grant execute on all functions in schema private to authenticated, service_role;
