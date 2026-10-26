"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { docSettingsSchema, templateSchema } from "./schemas";

async function isManager() {
  return hasRole(await getCurrentUser(), "super_admin", "manager");
}

export async function saveDocSettings(projectId: string, input: unknown): Promise<ActionResult> {
  if (!(await isManager())) return { ok: false, error: "Only managers can change document settings." };
  const parsed = docSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const v = parsed.data;
  const n = (s: string) => (s === "" ? null : s);
  const num = (s: string) => (s === "" ? null : Number(s));
  const supabase = await createClient();
  const { error } = await supabase.from("project_document_settings").upsert({
    project_id: projectId,
    display_name: n(v.display_name),
    full_address: n(v.full_address),
    execution_city: n(v.execution_city),
    seller_legal_name: v.seller_legal_name,
    seller_legal_status: n(v.seller_legal_status),
    seller_ntn: n(v.seller_ntn),
    seller_office_address: n(v.seller_office_address),
    seller_account_title: n(v.seller_account_title),
    signatory_name: n(v.signatory_name),
    signatory_cnic: n(v.signatory_cnic),
    managing_director_name: n(v.managing_director_name),
    approval_noc_ref: n(v.approval_noc_ref),
    possession_timeline: n(v.possession_timeline),
    delay_compensation_basis: n(v.delay_compensation_basis),
    refund_days_after_resale: num(v.refund_days_after_resale),
    discrepancy_report_days: num(v.discrepancy_report_days),
    allotment_countersign_days: num(v.allotment_countersign_days),
    ndc_validity_days: Number(v.ndc_validity_days),
    dispute_window_days: Number(v.dispute_window_days),
    marketed_by: v.marketed_by,
    // numeric(5,1) columns sent as strings → exact
    letterhead_top_mm: v.letterhead_top_mm as unknown as number,
    letterhead_bottom_mm: v.letterhead_bottom_mm as unknown as number,
    letterhead_left_mm: v.letterhead_left_mm as unknown as number,
    letterhead_right_mm: v.letterhead_right_mm as unknown as number,
    letterhead_head_top_mm: v.letterhead_head_top_mm === "" ? null : (v.letterhead_head_top_mm as unknown as number),
    letterhead_head_left_mm: v.letterhead_head_left_mm === "" ? null : (v.letterhead_head_left_mm as unknown as number),
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/settings/projects/${projectId}/documents`);
  return { ok: true, message: "Document settings saved." };
}

/** After the browser uploads a letterhead PDF to storage, link it to the project (or clear it with null). */
export async function setLetterhead(projectId: string, path: string | null): Promise<ActionResult> {
  if (!(await isManager())) return { ok: false, error: "Only managers can change the letterhead." };
  if (path !== null && !(path.startsWith(`letterheads/${projectId}/`) && path.toLowerCase().endsWith(".pdf"))) {
    return { ok: false, error: "Invalid letterhead file." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_document_settings")
    .upsert({ project_id: projectId, letterhead_path: path }, { onConflict: "project_id" });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/settings/projects/${projectId}/documents`);
  return { ok: true, message: path ? "Letterhead saved. Previews now print on it." : "Letterhead removed." };
}

export async function saveTemplate(projectId: string, docType: string, input: unknown): Promise<ActionResult> {
  if (!(await isManager())) return { ok: false, error: "Only managers can change document wording." };
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template" };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_document_template", {
    p_project_id: projectId,
    p_doc_type: docType as never,
    p_title: v.title,
    p_ref_prefix: v.ref_prefix,
    p_sections: v.sections as never,
    p_reason: v.reason,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/settings/projects/${projectId}/documents`);
  return { ok: true, message: "New wording saved. Earlier versions are kept." };
}

export async function installTemplateSet(projectId: string, set: string): Promise<ActionResult> {
  if (!(await isManager())) return { ok: false, error: "Only managers can install templates." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("install_document_templates", { p_project_id: projectId, p_set: set });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/settings/projects/${projectId}/documents`);
  return { ok: true, message: `${data} document templates installed.` };
}
