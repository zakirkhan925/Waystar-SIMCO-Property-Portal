"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { toAuthEmail } from "@/lib/auth/identifier";
import { createUserSchema, newPasswordSchema, temporaryPassword, userFormSchema } from "./schemas";

const BAN_FOREVER = "876000h"; // ~100 years: blocks sign-in for deactivated staff

/**
 * Creating and updating staff accounts needs the service-role key. If it is missing the
 * deployment is simply not configured for it — say so plainly instead of letting the throw
 * escape the server action, which replaces the whole page with "a server-side exception".
 * Only Super Admins reach this code, so naming the variable is useful rather than leaky.
 */
const ADMIN_UNAVAILABLE =
  "User management is not configured on this deployment: SUPABASE_SERVICE_ROLE_KEY is missing. " +
  "Add it to the environment variables and redeploy. Until then, staff accounts can be created in Supabase.";

/** Returns the admin client, or the reason it is unusable. The reason never contains the key. */
function adminOrReason(): { admin: ReturnType<typeof createAdminClient>; reason?: never } | { admin?: never; reason: string } {
  try {
    return { admin: createAdminClient() };
  } catch (e) {
    const message = (e as Error).message;
    return { reason: message.includes("is not set") ? ADMIN_UNAVAILABLE : message };
  }
}

async function assertSuperAdmin() {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin")) throw new Error("Only a Super Admin can manage users.");
  return user;
}

async function setProjectAccess(userId: string, projectIds: string[]) {
  const supabase = await createClient(); // as the Super Admin: RLS allows insert/delete
  const { data: current } = await supabase.from("user_project_access").select("project_id").eq("user_id", userId);
  const have = new Set((current ?? []).map((r) => r.project_id));
  const want = new Set(projectIds);
  const toAdd = [...want].filter((p) => !have.has(p)).map((project_id) => ({ user_id: userId, project_id }));
  const toRemove = [...have].filter((p) => !want.has(p));
  if (toAdd.length) {
    const { error } = await supabase.from("user_project_access").insert(toAdd);
    if (error) throw error;
  }
  if (toRemove.length) {
    const { error } = await supabase.from("user_project_access").delete().eq("user_id", userId).in("project_id", toRemove);
    if (error) throw error;
  }
}

export async function createUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await assertSuperAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const v = parsed.data;
  const a = adminOrReason();
  if (!a.admin) return { ok: false, error: a.reason };
  const admin = a.admin;

  // Role lives in app_metadata (not editable by the user); the DB trigger copies it to profiles.
  // No mail is ever sent: the account identifier is <username>@waystar.internal and the
  // admin hands over the password directly. email_confirm skips verification entirely.
  const { data, error } = await admin.auth.admin.createUser({
    email: toAuthEmail(v.username),
    password: v.password,
    email_confirm: true,
    app_metadata: { role: v.role },
    user_metadata: { full_name: v.full_name, phone: v.phone || undefined, username: v.username },
  });
  if (error || !data.user) {
    const msg = (error?.message ?? "").toLowerCase();
    // Supabase answers a key it does not recognise with a bare "Invalid API key".
    if (msg.includes("invalid api key") || msg.includes("invalid jwt")) {
      return {
        ok: false,
        error:
          "Supabase rejected the service-role key. It is well-formed but not a valid key for this project — " +
          "check it was copied from Project Settings → API Keys of THIS project (service_role, not publishable), " +
          "re-save it and redeploy.",
      };
    }
    const exists = msg.includes("already");
    return {
      ok: false,
      error: exists ? "That username is already taken." : (error?.message ?? "Could not create user."),
      fieldErrors: exists ? { username: ["Already taken"] } : undefined,
    };
  }

  try {
    await setProjectAccess(data.user.id, v.project_ids);
  } catch (e) {
    return { ok: false, error: `User created, but project access failed: ${(e as Error).message}` };
  }

  // The username, the real email (contact only) and the force-change flag live on the profile.
  // The auth trigger created the row; this fills in what it could not know.
  const supabase = await createClient();
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ username: v.username, email: v.email || null, must_change_password: true })
    .eq("id", data.user.id);
  if (profileErr) {
    return { ok: false, error: `Account created, but saving the username failed: ${dbErrorMessage(profileErr)}` };
  }

  revalidatePath("/settings/users");
  return {
    ok: true,
    data: { id: data.user.id },
    message: `${v.full_name} added. Give them the username "${v.username}" and the password you set — they must change it at first sign-in.`,
  };
}

export async function updateUser(userId: string, input: unknown): Promise<ActionResult> {
  let me;
  try {
    me = await assertSuperAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = userFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const v = parsed.data;
  if (userId === me.id && (v.role !== "super_admin" || !v.is_active)) {
    return { ok: false, error: "You can't remove your own Super Admin access." };
  }
  // Checked before the profile write below, so a missing key cannot leave the profile
  // updated while the matching auth change silently never happens.
  const a = adminOrReason();
  if (!a.admin) return { ok: false, error: a.reason };
  const admin = a.admin;

  // Profile update runs as the Super Admin so the DB guard + audit log record who did it.
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: v.full_name,
      phone: v.phone || null,
      role: v.role,
      is_active: v.is_active,
      username: v.username,
      email: v.email || null,
    })
    .eq("id", userId);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: v.role },
    ban_duration: v.is_active ? "none" : BAN_FOREVER,
  });
  if (authErr) return { ok: false, error: `Saved profile, but sign-in status failed to update: ${authErr.message}` };

  try {
    await setProjectAccess(userId, v.project_ids);
  } catch (e) {
    return { ok: false, error: `Project access failed: ${(e as Error).message}` };
  }

  revalidatePath("/settings/users");
  return { ok: true, message: "User updated." };
}

/**
 * Issue a new temporary password. Staff sign in with a username and may have no email at
 * all, so there is nowhere to send a reset link — the Super Admin sets one and hands it over.
 * The force-change flag means the person still picks their own on next sign-in.
 */
export async function setTemporaryPassword(input: unknown): Promise<ActionResult> {
  try {
    await assertSuperAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const v = parsed.data;
  const a = adminOrReason();
  if (!a.admin) return { ok: false, error: a.reason };

  const { error } = await a.admin.auth.admin.updateUserById(v.user_id, { password: v.password });
  if (error) return { ok: false, error: error.message };

  const supabase = await createClient();
  const { error: flagErr } = await supabase
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", v.user_id);
  if (flagErr) return { ok: false, error: dbErrorMessage(flagErr) };

  revalidatePath("/settings/users");
  return { ok: true, message: "New password set. They must change it at next sign-in." };
}

/** The person changes their own password, which clears the force-change flag. */
export async function changeOwnPassword(password: string): Promise<ActionResult> {
  const parsed = temporaryPassword.safeParse(password);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false, error: "You are not signed in." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { ok: false, error: error.message };

  const { error: flagErr } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userId);
  if (flagErr) return { ok: false, error: dbErrorMessage(flagErr) };

  revalidatePath("/", "layout");
  return { ok: true, message: "Password changed." };
}
