import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DocumentTemplate, TemplateSection } from "./template";

/** Active template for a project + document type (falls back to a global default, if one exists). */
export async function loadTemplate(projectId: string, docType: string): Promise<DocumentTemplate | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("document_templates")
    .select("doc_type, version, title, ref_prefix, sections, project_id")
    .eq("doc_type", docType as never)
    .eq("is_active", true)
    .or(`project_id.eq.${projectId},project_id.is.null`);
  const row = (data ?? []).sort((a, b) => (a.project_id ? 0 : 1) - (b.project_id ? 0 : 1))[0];
  if (!row) return null;
  return { ...row, sections: row.sections as unknown as TemplateSection[] };
}

export async function loadDocContextBase(projectId: string) {
  const supabase = await createClient();
  const [{ data: project }, { data: settings }, { data: company }] = await Promise.all([
    supabase.from("projects").select("id, code, name, location").eq("id", projectId).single(),
    supabase.from("project_document_settings").select("*").eq("project_id", projectId).maybeSingle(),
    supabase.from("company_settings").select("*").single(),
  ]);
  if (!project || !company) return null;

  const stringified: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(settings ?? {})) {
    if (["project_id", "updated_at", "updated_by"].includes(k)) continue;
    stringified[k] = v === null || v === undefined ? null : String(v);
  }
  return {
    company: {
      name: company.company_name,
      partnerName: company.partner_name,
      address: company.address,
      phone: company.phone,
      email: company.email,
      website: company.website,
    },
    project: {
      code: project.code,
      name: project.name,
      displayName: settings?.display_name ?? project.name.toUpperCase(),
      fullAddress: settings?.full_address ?? project.location,
    },
    settings: stringified,
    letterheadPath: settings?.letterhead_path ?? null,
  };
}

/** Letterhead PDF bytes from storage (branding bucket), or null if missing. */
export async function loadLetterhead(path: string | null): Promise<Uint8Array | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("branding").download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
