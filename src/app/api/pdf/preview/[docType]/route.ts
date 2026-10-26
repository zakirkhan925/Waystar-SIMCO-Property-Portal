import type { NextRequest } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { todayPK } from "@/lib/dates";
import { PRINTABLE_DOC_TYPES, type PrintableDocType } from "@/pdf/documents";
import { layoutFor } from "@/pdf/letterhead";
import { loadDocContextBase, loadLetterhead, loadTemplate } from "@/pdf/load";
import { pdfResponse, qrDataUrl, renderDocumentPdf } from "@/pdf/render";
import { sampleDeal } from "@/pdf/sample";

export const runtime = "nodejs";

/** SPECIMEN preview of a project's document template filled with sample data (managers / admins). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ docType: string }> }) {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin", "manager")) return new Response("Forbidden", { status: 403 });

  const { docType } = await params;
  if (!PRINTABLE_DOC_TYPES.includes(docType as PrintableDocType)) return new Response("Unknown document", { status: 404 });
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return new Response("projectId is required", { status: 400 });

  const [base, template] = await Promise.all([loadDocContextBase(projectId), loadTemplate(projectId, docType)]);
  if (!base) return new Response("Project not found", { status: 404 });
  if (!template) return new Response("No template installed for this document. Install one in Settings → Projects → Documents.", { status: 404 });

  // ?mode=letterhead | preprinted | plain (default: letterhead when the project has one)
  const { letterheadPath, ...ctxBase } = base;
  const layout = layoutFor(request.nextUrl.searchParams.get("mode"), base.settings);
  const today = todayPK();
  const buffer = await renderDocumentPdf(
    {
      ...ctxBase,
      ...sampleDeal(today),
      docType,
      template,
      layout,
      verifyUrl: null,
      qrDataUrl: await qrDataUrl(`SPECIMEN ${base.project.code} ${template.ref_prefix}`),
    },
    layout.mode === "letterhead" ? await loadLetterhead(letterheadPath) : null,
  );
  return pdfResponse(buffer, `${base.project.code}-${template.ref_prefix}-${layout.mode}-SPECIMEN.pdf`);
}
