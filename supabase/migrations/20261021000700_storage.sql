-- Phase 1: storage buckets.
-- client-docs : private. Path = clients/{client_id}/{uuid}-{filename}  (CNIC scans, photos)
-- unit-media  : private. Path = units/{unit_id}/{uuid}-{filename}
-- branding    : public.  Project / company logos and cover images (non-sensitive)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('client-docs', 'client-docs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('unit-media',  'unit-media',  false, 20971520, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('branding',    'branding',    true,   5242880, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do nothing;

create or replace function private.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- client-docs: readable by whoever can read the client row (clients RLS applies inside the subquery)
create policy client_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'client-docs'
         and (storage.foldername(name))[1] = 'clients'
         and exists (select 1 from public.clients c
                     where c.id = private.try_uuid((storage.foldername(name))[2])));
create policy client_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'client-docs'
              and (storage.foldername(name))[1] = 'clients'
              and (select private.has_role('super_admin','manager','sales_agent'))
              and exists (select 1 from public.clients c
                          where c.id = private.try_uuid((storage.foldername(name))[2])));
create policy client_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-docs' and (select private.has_role('super_admin')));

-- unit-media
create policy unit_media_select on storage.objects for select to authenticated
  using (bucket_id = 'unit-media'
         and (storage.foldername(name))[1] = 'units'
         and exists (select 1 from public.units u
                     where u.id = private.try_uuid((storage.foldername(name))[2])));
create policy unit_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'unit-media' and (select private.has_role('super_admin','manager')));
create policy unit_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'unit-media' and (select private.has_role('super_admin')));

-- branding (public read via public URL; writes by admins)
create policy branding_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and (select private.has_role('super_admin','manager')));
create policy branding_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and (select private.has_role('super_admin','manager')));
create policy branding_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and (select private.has_role('super_admin','manager')));

grant execute on all functions in schema private to authenticated, service_role;
