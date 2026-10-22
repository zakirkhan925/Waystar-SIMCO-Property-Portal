-- If a project's marla/kanal factor changes, recompute area_sqft for its marla/kanal units
-- (units_before_write does the maths; this just re-runs it).
create or replace function private.projects_area_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.sqft_per_marla is distinct from old.sqft_per_marla
     or new.marla_per_kanal is distinct from old.marla_per_kanal then
    perform set_config('app.reason', 'Area recalculated after marla/kanal size change on project', true);
    update public.units
       set size_value = size_value
     where project_id = new.id and size_unit in ('marla','kanal');
  end if;
  return null;
end $$;

create trigger projects_area_changed after update of sqft_per_marla, marla_per_kanal on public.projects
  for each row execute function private.projects_area_changed();

grant execute on all functions in schema private to authenticated, service_role;
