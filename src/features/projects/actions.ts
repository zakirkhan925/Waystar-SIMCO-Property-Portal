"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { blockSchema, floorsBulkSchema, projectFormSchema, type ProjectFormParsed } from "./schemas";

async function requireManager() {
  const user = await getCurrentUser();
  return hasRole(user, "super_admin", "manager");
}

function toRow(v: ProjectFormParsed) {
  return {
    name: v.name,
    code: v.code,
    type: v.type,
    status: v.status,
    location: v.location || null,
    description: v.description || null,
    // numeric columns as strings → exact in Postgres
    sqft_per_marla: v.sqft_per_marla as unknown as number,
    marla_per_kanal: v.marla_per_kanal as unknown as number,
    late_fee_method: v.late_fee_method,
    late_fee_rate: v.late_fee_rate as unknown as number,
    late_fee_grace_days: Number(v.late_fee_grace_days),
    late_fee_cap_pct: v.late_fee_cap_pct === "" ? null : (v.late_fee_cap_pct as unknown as number),
    corner_premium_pct: (v.corner_premium_pct || "0") as unknown as number,
    cancel_after_consecutive_missed: v.cancel_after_consecutive_missed === "" ? null : Number(v.cancel_after_consecutive_missed),
    cancellation_deduction_pct: v.cancellation_deduction_pct === "" ? null : (v.cancellation_deduction_pct as unknown as number),
    construction_min_paid_pct: v.construction_min_paid_pct === "" ? null : (v.construction_min_paid_pct as unknown as number),
    full_payment_possession_charge_pct: (v.full_payment_possession_charge_pct || "0") as unknown as number,
    down_payment_balance_days: v.down_payment_balance_days === "" ? null : Number(v.down_payment_balance_days),
    sort_order: Number(v.sort_order),
    is_active: v.is_active,
  };
}

export async function createProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await requireManager())) return { ok: false, error: "Only managers can create projects." };
  const parsed = projectFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").insert(toRow(parsed.data)).select("id").single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/projects");
  revalidatePath("/settings/projects");
  return { ok: true, data: { id: data.id }, message: "Project created. Now add its blocks or towers." };
}

export async function updateProject(id: string, input: unknown): Promise<ActionResult> {
  if (!(await requireManager())) return { ok: false, error: "Only managers can edit projects." };
  const parsed = projectFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(toRow(parsed.data)).eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Project saved." };
}

export async function addBlock(projectId: string, input: unknown): Promise<ActionResult> {
  if (!(await requireManager())) return { ok: false, error: "Only managers can change project structure." };
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { count } = await supabase.from("blocks").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  const { error } = await supabase
    .from("blocks")
    .insert({ project_id: projectId, name: parsed.data.name, kind: parsed.data.kind, sort_order: (count ?? 0) + 1 });
  if (error) return { ok: false, error: error.code === "23505" ? "That name is already used in this project." : dbErrorMessage(error) };
  revalidatePath(`/settings/projects/${projectId}`);
  return { ok: true, message: `${parsed.data.name} added.` };
}

export async function renameBlock(blockId: string, name: string): Promise<ActionResult> {
  if (!(await requireManager())) return { ok: false, error: "Only managers can change project structure." };
  const parsed = z.string().trim().min(1).max(40).safeParse(name);
  if (!parsed.success) return { ok: false, error: "Enter a name (max 40 characters)." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("blocks").update({ name: parsed.data }).eq("id", blockId).select("project_id").single();
  if (error) return { ok: false, error: error.code === "23505" ? "That name is already used in this project." : dbErrorMessage(error) };
  revalidatePath(`/settings/projects/${data.project_id}`);
  return { ok: true, message: "Renamed." };
}

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
};

/** Adds Basement(s), Ground, Mezzanine and numbered floors to a tower; existing labels are skipped. */
export async function addFloors(blockId: string, input: unknown): Promise<ActionResult> {
  if (!(await requireManager())) return { ok: false, error: "Only managers can change project structure." };
  const parsed = floorsBulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;

  const wanted: { label: string; level: number; sort_order: number }[] = [];
  for (let b = v.basements; b >= 1; b--) {
    wanted.push({ label: v.basements === 1 ? "Basement" : `Basement ${b}`, level: -b, sort_order: 100 - b * 10 });
  }
  if (v.ground) wanted.push({ label: "Ground", level: 0, sort_order: 100 });
  if (v.mezzanine) wanted.push({ label: "Mezzanine", level: 0, sort_order: 105 });
  if (v.to > 0) for (let f = v.from; f <= v.to; f++) wanted.push({ label: ordinal(f), level: f, sort_order: 100 + f * 10 });
  if (wanted.length === 0) return { ok: false, error: "Nothing to add." };

  const supabase = await createClient();
  const { data: block } = await supabase.from("blocks").select("project_id").eq("id", blockId).single();
  const { data: existing } = await supabase.from("floors").select("label").eq("block_id", blockId).is("deleted_at", null);
  const have = new Set((existing ?? []).map((f) => f.label.toLowerCase()));
  const rows = wanted.filter((w) => !have.has(w.label.toLowerCase())).map((w) => ({ ...w, block_id: blockId }));
  if (rows.length === 0) return { ok: true, message: "Those floors already exist." };

  const { error } = await supabase.from("floors").insert(rows);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (block) revalidatePath(`/settings/projects/${block.project_id}`);
  return { ok: true, message: `${rows.length} floor${rows.length === 1 ? "" : "s"} added.` };
}

export async function deleteBlock(blockId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { count } = await supabase.from("units").select("id", { count: "exact", head: true }).eq("block_id", blockId).is("deleted_at", null);
  if (count) return { ok: false, error: `This has ${count} units. Move or delete them first.` };
  const { data: block } = await supabase.from("blocks").select("project_id").eq("id", blockId).single();
  const { error } = await supabase.rpc("soft_delete", { p_table: "blocks", p_id: blockId, p_reason: reason });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (block) revalidatePath(`/settings/projects/${block.project_id}`);
  return { ok: true, message: "Deleted." };
}

export async function deleteFloor(floorId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { count } = await supabase.from("units").select("id", { count: "exact", head: true }).eq("floor_id", floorId).is("deleted_at", null);
  if (count) return { ok: false, error: `This floor has ${count} units. Move or delete them first.` };
  const { error } = await supabase.rpc("soft_delete", { p_table: "floors", p_id: floorId, p_reason: reason });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/settings/projects", "layout");
  return { ok: true, message: "Floor deleted." };
}
