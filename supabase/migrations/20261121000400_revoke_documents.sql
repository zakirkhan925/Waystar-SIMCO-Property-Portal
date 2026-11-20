create trigger issued_documents_revoke_audit
  after update of revoked_at on public.issued_documents
  for each row execute function private.audit_row();

create function public.revoke_document(p_token text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(btrim(p_reason, E' \t\n\r'), '');
begin
  if not private.has_role('super_admin') then
    raise exception 'Only a Super Admin can revoke a document' using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'Give a reason for revoking the document' using errcode = '22023';
  end if;

  perform set_config('app.reason', v_reason, true);
  update public.issued_documents
  set revoked_at = clock_timestamp(), revoked_reason = v_reason
  where token = p_token and revoked_at is null;
  if not found then
    raise exception 'Document was not found or is already revoked' using errcode = '22023';
  end if;
end $$;

revoke execute on function public.revoke_document(text, text) from public, anon, authenticated;
grant execute on function public.revoke_document(text, text) to authenticated;
