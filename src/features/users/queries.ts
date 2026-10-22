import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listUsers() {
  const supabase = await createClient();
  const [{ data: profiles }, { data: access }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone, role, is_active, created_at").neq("role", "client").order("full_name"),
    supabase.from("user_project_access").select("user_id, project_id"),
  ]);
  const byUser = new Map<string, string[]>();
  for (const a of access ?? []) byUser.set(a.user_id, [...(byUser.get(a.user_id) ?? []), a.project_id]);
  return (profiles ?? []).map((p) => ({ ...p, project_ids: byUser.get(p.id) ?? [] }));
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

export async function listProjectsBrief() {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("id, name, code").is("deleted_at", null).order("sort_order");
  return data ?? [];
}
