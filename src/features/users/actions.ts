"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { userFormSchema } from "./schemas";

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
  const parsed = userFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const v = parsed.data;
  const a = adminOrReason();
  if (!a.admin) return { ok: false, error: a.reason };
  const admin = a.admin;

  // Role lives in app_metadata (not editable by the user); the DB trigger copies it to profiles.
  const { data, error } = await admin.auth.admin.createUser({
    email: v.email,
    email_confirm: true,
    app_metadata: { role: v.role },
    user_metadata: { full_name: v.full_name, phone: v.phone || undefined },
  });
  if (error || !data.user) {
    const exists = error?.message.toLowerCase().includes("already");
    return {
      ok: false,
      error: exists ? "A user with this email already exists." : (error?.message ?? "Could not create user."),
      fieldErrors: exists ? { email: ["Already registered"] } : undefined,
    };
  }

  try {
    await setProjectAccess(data.user.id, v.project_ids);
  } catch (e) {
    return { ok: false, error: `User created, but project access failed: ${(e as Error).message}` };
  }

  // Email a link to choose their own password (no admin-chosen passwords).
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await supabase.auth.resetPasswordForEmail(v.email, { redirectTo: `${site}/auth/callback?next=/reset-password` });

  revalidatePath("/settings/users");
  return { ok: true, data: { id: data.user.id }, message: `${v.full_name} added. A link to set their password was emailed.` };
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
    .update({ full_name: v.full_name, phone: v.phone || null, role: v.role, is_active: v.is_active })
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

export async function sendPasswordReset(email: string): Promise<ActionResult> {
  try {
    await assertSuperAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site}/auth/callback?next=/reset-password` });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "Password reset link sent." };
}
