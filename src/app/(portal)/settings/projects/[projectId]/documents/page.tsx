import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocSettingsForm } from "@/features/documents/doc-settings-form";
import { InstallTemplatesButton } from "@/features/documents/install-button";
import { getProject } from "@/features/projects/queries";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { DOC_LABELS, PRINTABLE_DOC_TYPES } from "@/pdf/documents";

export const metadata: Metadata = { title: "Project documents" };

export default async function ProjectDocumentsPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireRole("super_admin", "manager");
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const supabase = await createClient();
  const [{ data: settings }, { data: templates }] = await Promise.all([
    supabase.from("project_document_settings").select("*").eq("project_id", projectId).maybeSingle(),
    supabase
      .from("document_templates")
      .select("doc_type, version, title, ref_prefix, created_at")
      .eq("project_id", projectId)
      .eq("is_active", true),
  ]);
  const byType = new Map((templates ?? []).map((t) => [t.doc_type as string, t]));
  const s = settings;
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Projects", href: "/settings/projects" },
          { label: project.name, href: `/settings/projects/${projectId}` },
          { label: "Documents" },
        ]}
        title={`${project.name} — documents`}
        description="Printable forms and letters for this project: wording, reference prefixes and the details that fill their blanks."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>Preview shows a SPECIMEN filled with sample data. Real documents are issued from bookings.</CardDescription>
          </CardHeader>
          <CardContent>
            {byType.size === 0 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4 text-sm">
                <span className="flex-1">No document templates are installed for this project yet.</span>
                {project.type === "plot_society" && (
                  <InstallTemplatesButton projectId={projectId} label="Install SIMCO plot-society templates" />
                )}
              </div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {PRINTABLE_DOC_TYPES.map((dt) => {
                  const t = byType.get(dt);
                  return (
                    <li key={dt} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <FileText className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{DOC_LABELS[dt]}</div>
                        <div className="text-xs text-muted-foreground">
                          {t ? `Ref. ${t.ref_prefix}-… · version ${t.version} · updated ${formatDate(t.created_at)}` : "Not installed"}
                        </div>
                      </div>
                      {t ? (
                        <>
                          <Badge variant="outline">v{t.version}</Badge>
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/api/pdf/preview/${dt}?projectId=${projectId}`} target="_blank" rel="noopener noreferrer">
                              Preview PDF
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/settings/projects/${projectId}/documents/${dt}`}>
                              <Pencil /> Edit wording
                            </Link>
                          </Button>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <DocSettingsForm
          projectId={projectId}
          initial={{
            display_name: str(s?.display_name),
            full_address: str(s?.full_address),
            execution_city: str(s?.execution_city),
            seller_legal_name: s?.seller_legal_name ?? "SIMCO DEVELOPERS",
            seller_legal_status: str(s?.seller_legal_status),
            seller_ntn: str(s?.seller_ntn),
            seller_office_address: str(s?.seller_office_address),
            seller_account_title: str(s?.seller_account_title),
            signatory_name: str(s?.signatory_name),
            signatory_cnic: str(s?.signatory_cnic),
            managing_director_name: str(s?.managing_director_name),
            approval_noc_ref: str(s?.approval_noc_ref),
            possession_timeline: str(s?.possession_timeline),
            delay_compensation_basis: str(s?.delay_compensation_basis),
            refund_days_after_resale: str(s?.refund_days_after_resale),
            discrepancy_report_days: str(s?.discrepancy_report_days),
            allotment_countersign_days: str(s?.allotment_countersign_days),
            ndc_validity_days: str(s?.ndc_validity_days ?? 7),
            dispute_window_days: str(s?.dispute_window_days ?? 7),
            marketed_by: s?.marketed_by ?? "Waystar Royco",
          }}
        />
      </div>
    </>
  );
}
