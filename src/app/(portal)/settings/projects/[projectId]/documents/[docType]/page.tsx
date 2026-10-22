import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { TemplateEditor } from "@/features/documents/template-editor";
import { getProject } from "@/features/projects/queries";
import { requireRole } from "@/lib/auth/session";
import { DOC_LABELS, PRINTABLE_DOC_TYPES, type PrintableDocType } from "@/pdf/documents";
import { loadTemplate } from "@/pdf/load";

export const metadata: Metadata = { title: "Edit document wording" };

export default async function EditTemplatePage({ params }: { params: Promise<{ projectId: string; docType: string }> }) {
  await requireRole("super_admin", "manager");
  const { projectId, docType } = await params;
  if (!PRINTABLE_DOC_TYPES.includes(docType as PrintableDocType)) notFound();
  const [project, template] = await Promise.all([getProject(projectId), loadTemplate(projectId, docType)]);
  if (!project || !template) notFound();

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Settings", href: "/settings" },
          { label: project.name, href: `/settings/projects/${projectId}` },
          { label: "Documents", href: `/settings/projects/${projectId}/documents` },
          { label: DOC_LABELS[docType as PrintableDocType] },
        ]}
        title={`${DOC_LABELS[docType as PrintableDocType]} — ${project.name}`}
        description="Particulars tables (plot, buyer, amounts) are filled from the system; edit the clause wording here."
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/pdf/preview/${docType}?projectId=${projectId}`} target="_blank" rel="noopener noreferrer">
              Preview PDF
            </a>
          </Button>
        }
      />
      {/* key forces a fresh editor after saving a new version */}
      <TemplateEditor key={template.version} projectId={projectId} template={template} />
    </>
  );
}
