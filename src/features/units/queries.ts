import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { UnitFilters } from "./filters";

export const UNIT_LIST_COLUMNS =
  "id, unit_no, street, category, use, size_value, size_unit, width_ft, depth_ft, area_sqft, bedrooms, base_price, price_per_sqft, status, is_corner, is_park_facing, is_main_boulevard, block_id, floor_id, blocks(name), floors(label, level)";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

function filteredUnits(supabase: SupabaseServer, projectId: string, f: UnitFilters, withCount: boolean) {
  let q = supabase
    .from("units")
    .select(UNIT_LIST_COLUMNS, withCount ? { count: "exact" } : undefined)
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if (f.q) q = q.ilike("unit_no", `%${f.q.replace(/[%_]/g, "")}%`);
  if (f.block) q = q.eq("block_id", f.block);
  if (f.floor) q = q.eq("floor_id", f.floor);
  if (f.category) q = q.eq("category", f.category);
  if (f.status) q = q.eq("status", f.status);
  if (f.minSize !== undefined) q = q.gte("area_sqft", f.minSize);
  if (f.maxSize !== undefined) q = q.lte("area_sqft", f.maxSize);
  if (f.minPrice !== undefined) q = q.gte("base_price", f.minPrice);
  if (f.maxPrice !== undefined) q = q.lte("base_price", f.maxPrice);
  return q;
}

/** One page of units for the table view (server-side pagination + sorting). */
export async function listUnitsPage(projectId: string, f: UnitFilters) {
  const supabase = await createClient();
  const from = (f.page - 1) * f.size;
  const { data, count, error } = await filteredUnits(supabase, projectId, f, true)
    .order(f.sort, { ascending: f.dir === "asc" })
    .order("unit_no")
    .range(from, from + f.size - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

/** All matching units for the grid view / CSV export (capped). */
export async function listUnitsAll(projectId: string, f: UnitFilters, cap = 2000) {
  const supabase = await createClient();
  const { data, error } = await filteredUnits(supabase, projectId, f, false).order("unit_no").limit(cap);
  if (error) throw error;
  return data ?? [];
}

export type UnitListRow = Awaited<ReturnType<typeof listUnitsAll>>[number];

export async function getUnit(unitId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("*, projects(id, name, code, type), blocks(id, name, kind), floors(id, label, level)")
    .eq("id", unitId)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

export async function getActivity(tableName: string, recordId: string, limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("id, action, changed_fields, old_data, new_data, reason, changed_by, changed_at")
    .eq("table_name", tableName)
    .eq("record_id", recordId)
    .order("changed_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const userIds = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))] as string[];
  const { data: people } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string }[] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  return rows.map((r) => ({ ...r, changed_by_name: r.changed_by ? (names.get(r.changed_by) ?? "Unknown user") : "System" }));
}

export type ActivityRow = Awaited<ReturnType<typeof getActivity>>[number];
