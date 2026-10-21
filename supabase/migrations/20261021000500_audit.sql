-- Phase 1: activity log + generic audit trigger.
-- To record a reason with a change, run in the same transaction:
--   select set_config('app.reason', 'Price revised per SIMCO circular 12', true);

create table public.activity_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   text,
  project_id  uuid,
  action      public.audit_action not null,
  old_data    jsonb,
  new_data    jsonb,
  changed_fields text[],
  reason      text,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index activity_log_record_idx  on public.activity_log (table_name, record_id);
create index activity_log_project_idx on public.activity_log (project_id, changed_at desc);
create index activity_log_time_idx    on public.activity_log (changed_at desc);

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
      return null;                    -- no real change, don't log
    end if;
  end if;

  insert into public.activity_log (table_name, record_id, project_id, action, old_data, new_data,
                                   changed_fields, reason, changed_by)
  values (
    tg_table_name,
    coalesce(v_row->>'id', v_row->>'user_id'),
    case when tg_table_name = 'projects' then (v_row->>'id')::uuid
         else nullif(v_row->>'project_id','')::uuid end,
    lower(tg_op)::public.audit_action,
    v_old, v_new, v_changed,
    nullif(current_setting('app.reason', true), ''),
    auth.uid()
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','company_settings','projects','user_project_access',
                           'blocks','floors','units','clients','dealers']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
end $$;

-- activity_log is append-only for everyone except the table owner.
revoke insert, update, delete, truncate on public.activity_log from anon, authenticated;

grant execute on all functions in schema private to authenticated, service_role;
