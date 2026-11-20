import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { todayPK } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { summarizeCancellation } from "@/pdf/cancellation";
import { layoutFor } from "@/pdf/letterhead";
import { loadDocContextBase, loadLetterhead } from "@/pdf/load";
import { pdfResponse, renderDocumentPdf } from "@/pdf/render";
import { documentRef, loadSaleDeal } from "@/pdf/sale-context";
import { issueDocument } from "@/pdf/verification";

export const runtime = "nodejs";

const refuse = (message: string, status: number) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: NextRequest, { params }: { params: Promise<{ cancellationId: string }> }) {
  await getCurrentUser();
  const { cancellationId } = await params;

  try {
    const supabase = await createClient();
    const { data: cancellation, error } = await supabase.from("cancellations")
      .select("*").eq("id", cancellationId).maybeSingle();
    if (error) throw error;
    if (!cancellation) return refuse("Cancellation not found, or you do not have access to it.", 404);

    const [loaded, base] = await Promise.all([
      loadSaleDeal(cancellation.sale_id, todayPK()),
      loadDocContextBase(cancellation.project_id),
    ]);
    if (!loaded || !base) return refuse("The booking for this cancellation could not be loaded.", 404);

    const { letterheadPath, ...ctxBase } = base;
    const layout = layoutFor(request.nextUrl.searchParams.get("mode"), base.settings);
    const refNo = documentRef(loaded.bookingFormNo, "CNL");
    const verification = await issueDocument({
      docType: "cancellation_letter", refNo, saleId: cancellation.sale_id,
      projectId: cancellation.project_id, cancellationId,
    });
    const buffer = await renderDocumentPdf(
      {
        ...ctxBase,
        ...loaded.deal,
        docType: "cancellation_letter",
        template: {
          doc_type: "cancellation_letter", version: 1,
          title: "CANCELLATION AND REFUND LETTER", ref_prefix: "CNL", sections: [],
        },
        layout,
        refNo,
        ndcPurpose: null,
        ...verification,
        cancellation: {
          ...summarizeCancellation(cancellation),
          cancelledOn: cancellation.cancelled_on,
          reason: cancellation.reason,
        },
      },
      layout.mode === "letterhead" ? await loadLetterhead(letterheadPath) : null,
    );
    return pdfResponse(buffer, `${refNo}.pdf`);
  } catch (e) {
    console.error("[pdf/cancellation]", cancellationId, e);
    return refuse("The cancellation letter could not be generated. Please try again or contact support.", 500);
  }
}
