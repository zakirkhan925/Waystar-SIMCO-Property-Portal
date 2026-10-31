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

  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
