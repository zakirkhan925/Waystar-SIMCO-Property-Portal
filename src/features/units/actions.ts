"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { unitFormSchema, unitStatusChangeSchema, type UnitFormParsed } from "./schemas";

function toRow(v: UnitFormParsed) {
  return {
    block_id: v.block_id,
    floor_id: v.floor_id || null,
    street: v.street || null,
    unit_no: v.unit_no,
    category: v.category,
    use: v.use,
    // numeric columns are sent as strings so Postgres parses them exactly (no float rounding)
    size_value: v.size_value as unknown as number,
    size_unit: v.size_unit,
    width_ft: v.width_ft === "" ? null : (v.width_ft as unknown as number),
    depth_ft: v.depth_ft === "" ? null : (v.depth_ft as unknown as number),
    bedrooms: v.bedrooms === "" ? null : Number(v.bedrooms),
    bathrooms: v.bathrooms === "" ? null : Number(v.bathrooms),
    is_corner: v.is_corner,
    is_park_facing: v.is_park_facing,
    is_main_boulevard: v.is_main_boulevard,
    base_price: v.base_price as unknown as number,
    price_per_sqft: v.price_per_sqft === "" ? null : (v.price_per_sqft as unknown as number),
    status: v.status,
    notes: v.notes || null,
  };
}

function invalid(fieldErrors: Record<string, string[] | undefined>): ActionResult<never> {
  return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors as Record<string, string[]> };
}

export async function createUnit(projectId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin", "manager")) return { ok: false, error: "Only managers can add units." };

  const parsed = unitFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .insert({ project_id: projectId, ...toRow(parsed.data) })
    .select("id")
    .single();
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, data: { id: data.id }, message: "Unit added." };
}

export async function updateUnit(unitId: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin", "manager")) return { ok: false, error: "Only managers can edit units." };

  const parsed = unitFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);

  const supabase = await createClient();
  const { data: current } = await supabase.from("units").select("status, project_id").eq("id", unitId).single();
  const row = toRow(parsed.data);
  // Status of booked/sold/rented units is system-controlled; don't send it from the edit form.
  const patch: Record<string, unknown> = { ...row };
  if (current && !["available", "on_hold", "blocked"].includes(current.status)) delete patch.status;

  const { error } = await supabase.rpc("update_unit", {
    p_id: unitId,
    p_patch: patch as never,
    p_reason: parsed.data.reason || undefined,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(`/units/${unitId}`);
  if (current) revalidatePath(`/projects/${current.project_id}`);
  return { ok: true, message: "Unit updated." };
}

export async function changeUnitStatus(unitId: string, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin", "manager")) return { ok: false, error: "Only managers can change unit status." };

  const parsed = unitStatusChangeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_unit", {
    p_id: unitId,
    p_patch: { status: parsed.data.status },
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(`/units/${unitId}`);
  if (data) revalidatePath(`/projects/${data.project_id}`);
  return { ok: true, message: "Status updated." };
}

export async function deleteUnit(unitId: string, reason: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin")) return { ok: false, error: "Only a Super Admin can delete units." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete", { p_table: "units", p_id: unitId, p_reason: reason });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/projects", "layout");
  return { ok: true, message: "Unit deleted." };
}
