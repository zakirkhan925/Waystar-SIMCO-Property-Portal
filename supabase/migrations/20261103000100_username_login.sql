-- Username + password login, with no email required.
--
-- SIMCO's staff do not all have work email, and the client wants to hand someone a user ID
-- and a password directly rather than route them through an inbox. Supabase Auth has no
-- native username login, so a username is stored here and the account is created behind the
-- scenes as "<username>@waystar.internal". Nothing is ever sent to that address — it exists
-- only because auth.users needs a unique identifier.
--
-- Real email stays on profiles.email as an OPTIONAL contact field. The existing Super Admin
-- signs in with a genuine address, and that keeps working: the login form treats anything
-- containing "@" as an email and anything else as a username.

alter table public.profiles
  add column username text,
  -- set when an admin issues a password; cleared once the person picks their own
  add column must_change_password boolean not null default false;

-- Case-insensitive and unique. Letters, digits, dot, underscore and hyphen keep it typeable
-- over the phone and safe to splice into an email local-part.
create unique index profiles_username_uq on public.profiles (lower(username))
  where username is not null;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9._-]{3,32}$');

comment on column public.profiles.username is
  'Login name. The account is created as <username>@waystar.internal; no mail is ever sent there.';
comment on column public.profiles.must_change_password is
  'True while the person is still on the password an admin issued. The portal forces a change before anything else.';

-- Lets someone clear their own flag after changing their password, and lets a Super Admin
-- re-issue a temporary password. The profiles_update policy already restricts who may write.
-- Nothing else about this needs a new policy.

-- The existing Super Admin gets a username so they can sign in either way.
update public.profiles
   set username = 'zakir'
 where lower(email) = 'zakir.khan@simcodevelopers.com'
   and username is null;
