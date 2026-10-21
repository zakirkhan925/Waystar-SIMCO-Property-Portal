import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/labels";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
};

/** The logged-in staff member (cached per request). Redirects to /login if missing or deactivated. */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", userId)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }
  return { id: profile.id, email: profile.email, fullName: profile.full_name, role: profile.role };
});

export function hasRole(user: CurrentUser, ...roles: AppRole[]) {
  return roles.includes(user.role);
}

/** For pages: send users without the role back to the dashboard. */
export async function requireRole(...roles: AppRole[]) {
  const user = await getCurrentUser();
  if (!hasRole(user, ...roles)) redirect("/dashboard?error=forbidden");
  return user;
}

/** Role capabilities used to show/hide UI. RLS enforces the same rules in the database. */
export function can(user: CurrentUser) {
  const r = user.role;
  return {
    manageInventory: r === "super_admin" || r === "manager",
    manageProjects: r === "super_admin" || r === "manager",
    manageUsers: r === "super_admin",
    manageSettings: r === "super_admin",
    createClients: r === "super_admin" || r === "manager" || r === "sales_agent",
    softDelete: r === "super_admin",
    viewActivity: r !== "sales_agent" && r !== "client",
  };
}
