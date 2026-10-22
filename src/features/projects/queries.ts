import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getInventorySummary() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_project_inventory").select("*").order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function getProject(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("id", projectId).is("deleted_at", null).maybeSingle();
  return data;
}

export async function getProjectStructure(projectId: string) {
  const supabase = await createClient();
  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, name, kind, sort_order, floors(id, label, level, sort_order, deleted_at)")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("sort_order");
  return (blocks ?? []).map((b) => ({
    ...b,
    floors: (b.floors ?? []).filter((f) => !f.deleted_at).sort((a, z) => a.level - z.level || a.sort_order - z.sort_order),
  }));
}

export type ProjectStructure = Awaited<ReturnType<typeof getProjectStructure>>;
