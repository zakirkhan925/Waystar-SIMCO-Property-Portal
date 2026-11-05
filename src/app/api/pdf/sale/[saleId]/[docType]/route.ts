import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { todayPK } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { PRINTABLE_DOC_TYPES, type PrintableDocType } from "@/pdf/documents";
import { layoutFor } from "@/pdf/letterhead";
import { loadDocContextBase, loadLetterhead, loadTemplate } from "@/pdf/load";
import { pdfResponse, renderDocumentPdf } from "@/pdf/render";
import { documentRef, loadSaleDeal } from "@/pdf/sale-context";

export const runtime = "nodejs";

const refuse = (message: string, status: number) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/** A real document for a real sale. RLS on the reads decides who may print it. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ saleId: string; docType: string }> }) {
  await getCurrentUser();
  const { saleId, docType } = await params;
  if (!PRINTABLE_DOC_TYPES.includes(docType as PrintableDocType)) return refuse("Unknown document.", 404);

  try {
    const today = todayPK();
    const loaded = await loadSaleDeal(saleId, today);
    if (!loaded) return refuse("Sale not found, or you do not have access to it.", 404);

    // These documents state facts. The portal must not print them while the facts are untrue.
    if (loaded.status === "cancelled") {
      return refuse("This booking is cancelled, so documents cannot be issued for it.", 409);
    }
    if (docType === "ndc_letter" && loaded.outstanding.gt(0)) {
      return refuse(
        `A No Dues Certificate cannot be issued: ${formatPKR(loaded.outstanding.toFixed(2))} is still outstanding.`,
        409,
      );
    }
    if (docType === "possession_letter" && !loaded.hasPossession) {
      return refuse("Hand over possession on the sale first. The Possession Letter is issued from that record.", 409);
    }

    const [base, template] = await Promise.all([
      loadDocContextBase(loaded.projectId),
      loadTemplate(loaded.projectId, docType),
    ]);
    if (!base) return refuse("Project not found.", 404);
    if (!template) {
      return refuse("No template is installed for this document. Install one in Settings > Projects > Documents.", 404);
    }

    const { letterheadPath, ...ctxBase } = base;
    const layout = layoutFor(request.nextUrl.searchParams.get("mode"), base.settings);
    const refNo = docType === "booking_form" ? loaded.bookingFormNo : documentRef(loaded.bookingFormNo, template.ref_prefix);
    const buffer = await renderDocumentPdf(
      {
        ...ctxBase,
        ...loaded.deal,
        docType,
        template,
        layout,
        refNo,
        ndcPurpose: request.nextUrl.searchParams.get("purpose"),
        // no public verification page exists yet, so no QR that scans to nothing
        verifyUrl: null,
        qrDataUrl: null,
      },
      layout.mode === "letterhead" ? await loadLetterhead(letterheadPath) : null,
    );
    return pdfResponse(buffer, `${refNo}.pdf`);
  } catch (e) {
    console.error("[pdf/sale]", saleId, docType, e);
    return refuse(`The document could not be generated: ${(e as Error).message}`, 500);
  }
}
