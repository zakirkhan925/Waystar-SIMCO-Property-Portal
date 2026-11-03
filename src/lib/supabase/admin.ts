import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Thrown when the service-role key is missing or unusable. Never contains the key itself. */
export class AdminKeyError extends Error {}

/**
 * The key travels in the `apikey` and `Authorization` HTTP headers, and header values are
 * Latin-1 only. A key that picked up a stray character while being copied (a typographic
 * arrow, a non-breaking space, a line break) makes fetch fail deep inside supabase-js with
 * "Cannot convert argument to a ByteString", which says nothing about the real cause.
 * Check it here instead and report the position without ever echoing the value.
 */
function assertHeaderSafe(key: string) {
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    if (code > 255 || code < 0x20 || code === 0x7f) {
      throw new AdminKeyError(
        `SUPABASE_SERVICE_ROLE_KEY contains a character that cannot be sent in an HTTP header ` +
          `(position ${i}, code ${code}). The value was most likely copied with stray formatting. ` +
          `Copy it again from Supabase → Project Settings → API Keys and re-save it, then redeploy.`,
      );
    }
  }
}

/**
 * Is this actually the service-role key for THIS project?
 *
 * "Invalid API key" from GoTrue says nothing about why, and the usual causes are mundane:
 * the publishable/anon key pasted by mistake, or a key copied from a different Supabase
 * project. Both are visible without the secret: a legacy key is a JWT whose payload carries
 * the project ref and the role in clear base64, and the new-style keys are self-describing
 * by prefix. Only the signature is secret, and we never touch it.
 */
function describeKey(key: string, url: string): string | null {
  const expectedRef = /^https:\/\/([a-z0-9-]+)\.supabase\./.exec(url)?.[1] ?? null;

  if (key.startsWith("sb_publishable_")) {
    return "That is the publishable (public) key, not the service-role key.";
  }
  if (key.startsWith("sb_secret_")) return null; // right shape; only the server can judge the rest

  const parts = key.split(".");
  if (parts.length !== 3) {
    // The length alone usually identifies the mistake and gives nothing away: a real key is
    // 40+ characters, whereas the row's NAME on the new API Keys page is "default" (7).
    const hint =
      key.length < 20
        ? ` The stored value is only ${key.length} characters, so it looks like the key's NAME was copied rather than the key itself — on the new API Keys page the "default" label sits right next to the key.`
        : ` The stored value is ${key.length} characters.`;
    return `That does not look like a Supabase API key. Expected a JWT or a key starting sb_secret_.${hint}`;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8")) as {
      role?: string;
      ref?: string;
    };
    if (payload.role && payload.role !== "service_role") {
      return `That key's role is "${payload.role}", not "service_role". Copy the service_role key instead.`;
    }
    if (expectedRef && payload.ref && payload.ref !== expectedRef) {
      return `That key belongs to Supabase project "${payload.ref}", but this deployment points at "${expectedRef}". Copy the key from the right project.`;
    }
  } catch {
    return "That key is not a readable Supabase JWT — it may have been truncated when copied.";
  }
  return null;
}

/**
 * Service-role client. BYPASSES RLS — use only in server actions after checking the
 * caller's role (e.g. Super Admin creating users). Never import from client code.
 */
export function createAdminClient() {
  // A trailing newline or stray space survives copy-paste into a dashboard field and
  // would otherwise be sent as part of the credential.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new AdminKeyError("SUPABASE_SERVICE_ROLE_KEY is not set");
  assertHeaderSafe(key);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) throw new AdminKeyError("NEXT_PUBLIC_SUPABASE_URL is not set");

  const wrong = describeKey(key, url);
  if (wrong) {
    throw new AdminKeyError(
      `${wrong} Set SUPABASE_SERVICE_ROLE_KEY from Supabase → Project Settings → API Keys, then redeploy.`,
    );
  }

  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
