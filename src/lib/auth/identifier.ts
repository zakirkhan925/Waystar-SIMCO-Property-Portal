/**
 * Staff sign in with a username, not an email.
 *
 * Supabase Auth needs a unique identifier per account and has no native username login, so a
 * username becomes "<username>@waystar.internal" on the way in. Nothing is ever sent to that
 * address — it only exists to satisfy auth.users. The real address, where someone has one,
 * lives on profiles.email as a contact detail.
 *
 * Anything containing "@" is treated as a genuine email and passed through unchanged, so
 * accounts created before usernames existed keep working.
 */
export const INTERNAL_EMAIL_DOMAIN = "waystar.internal";

export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;

export function isEmailAddress(identifier: string) {
  return identifier.includes("@");
}

/** What to hand Supabase for a username or an email typed into the login box. */
export function toAuthEmail(identifier: string) {
  const id = identifier.trim();
  return isEmailAddress(id) ? id.toLowerCase() : `${id.toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

/** True when this address is only an internal stand-in and should never be shown or mailed. */
export function isInternalEmail(email: string | null | undefined) {
  return !!email && email.toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}
