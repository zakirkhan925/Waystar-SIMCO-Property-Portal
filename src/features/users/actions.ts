"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { createUserSchema, newPasswordSchema, temporaryPassword, userFormSchema } from "./schemas";

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

  // Runs in the database, so no service-role key is involved. The function checks the caller
  // is a Super Admin itself, creates the account, and grants project access in one transaction.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_staff", {
    p: {
      username: v.username,
      password: v.password,
      full_name: v.full_name,
      email: v.email || null,
      phone: v.phone || null,
      role: v.role,
      project_ids: v.project_ids,
    } as never,
  });
  if (error) {
    const msg = dbErrorMessage(error);
    return {
      ok: false,
      error: msg,
      fieldErrors: msg.toLowerCase().includes("username") ? { username: ["Already taken"] } : undefined,
    };
  }

  const row = data as unknown as { id: string };
  revalidatePath("/settings/users");
  return {
    ok: true,
    data: { id: row.id },
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

  // No auth-side call needed: private.my_role() reads profiles.role for every permission
  // check, and getCurrentUser() signs out anyone whose profile is no longer active.
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
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_password", {
    p_user: v.user_id,
    p_password: v.password,
  } as never);
  if (error) return { ok: false, error: dbErrorMessage(error) };

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
