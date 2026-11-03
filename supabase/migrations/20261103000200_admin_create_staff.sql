-- Create staff accounts from inside the database, with no service-role key.
--
-- Why: the portal's only use for SUPABASE_SERVICE_ROLE_KEY was auth.admin.createUser(). That
-- key bypasses every RLS policy, has to be copied by hand into the host, and getting it wrong
-- blocks the one screen that needs it. Since SIMCO issues a username and a password directly
-- — no email, no invitation link, no verification — none of GoTrue's email machinery is in
-- play, and the account is just a row.
--
-- supabase/seed.sql already creates accounts exactly this way, and those logins work, so the
-- shape below is the proven one: an auth.users row with a bcrypt password, plus the matching
-- auth.identities row that the password grant looks up.
--
-- The trade-off, stated plainly: this bypasses GoTrue, so Supabase's own password-strength
-- and leaked-password checks do not apply (the portal enforces its own minimum), and a future
-- change to Supabase's auth schema could require updating this function.
--
-- Safety: SECURITY DEFINER but gated on private.has_role('super_admin'), so only a Super
-- Admin can reach it, and it is revoked from anon.

create or replace function public.admin_create_staff(p jsonb)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_username text := lower(trim(p->>'username'));
  v_password text := p->>'password';
  v_full_name text := nullif(trim(p->>'full_name'), '');
  v_role public.app_role := (p->>'role')::public.app_role;
  v_email text := nullif(lower(trim(p->>'email')), '');
  v_login_email text;
  v_project uuid;
  v_row public.profiles;
begin
  if not private.has_role('super_admin') then
    raise exception 'Only a Super Admin can create users' using errcode = '42501';
  end if;
  if v_username is null or v_username !~ '^[a-z0-9._-]{3,32}$' then
    raise exception 'Username must be 3-32 characters: letters, digits, dot, underscore or hyphen';
  end if;
  if v_password is null or length(v_password) < 8 then
    raise exception 'The temporary password must be at least 8 characters';
  end if;
  if v_full_name is null then
    raise exception 'Enter the person''s name';
  end if;
  if v_role = 'client' then
    raise exception 'Client accounts are not created here';
  end if;
  if exists (select 1 from public.profiles where lower(username) = v_username) then
    raise exception 'That username is already taken';
  end if;

  -- The login identifier. Nothing is ever sent here; profiles.email holds any real address.
  v_login_email := v_username || '@waystar.internal';
  if exists (select 1 from auth.users u where lower(u.email) = v_login_email) then
    raise exception 'That username is already taken';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_login_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    now(),                                   -- no verification step: the admin vouched for them
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', v_role),
    jsonb_build_object('full_name', v_full_name, 'username', v_username),
    now(), now(), '', '', '', '', '', '', '', '');

  -- the password grant resolves the account through identities
  insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                               last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_login_email, 'email_verified', true),
          'email', now(), now(), now());

  -- private.handle_new_user() already inserted the profile; fill in what it could not know
  update public.profiles set
    username             = v_username,
    email                = v_email,
    phone                = nullif(trim(p->>'phone'), ''),
    full_name            = v_full_name,
    role                 = v_role,
    must_change_password = true
  where id = v_id
  returning * into v_row;

  for v_project in
    select (value)::uuid from jsonb_array_elements_text(coalesce(p->'project_ids', '[]'::jsonb))
  loop
    insert into public.user_project_access (user_id, project_id)
    values (v_id, v_project)
    on conflict do nothing;
  end loop;

  return v_row;
end $$;

revoke execute on function public.admin_create_staff(jsonb) from anon, public;
grant execute on function public.admin_create_staff(jsonb) to authenticated;

-- Issue a replacement password. There is no email to send a link to, so a Super Admin sets
-- one and hands it over; the force-change flag makes the person pick their own next time.
create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role('super_admin') then
    raise exception 'Only a Super Admin can set a password' using errcode = '42501';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'The temporary password must be at least 8 characters';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and role <> 'client') then
    raise exception 'User not found';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user;

  update public.profiles set must_change_password = true where id = p_user;
end $$;

revoke execute on function public.admin_set_password(uuid, text) from anon, public;
grant execute on function public.admin_set_password(uuid, text) to authenticated;

grant execute on all functions in schema private to authenticated, service_role;
