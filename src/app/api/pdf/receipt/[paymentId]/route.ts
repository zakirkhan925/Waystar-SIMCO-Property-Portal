import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { todayPK } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { layoutFor } from "@/pdf/letterhead";
import { loadDocContextBase, loadLetterhead } from "@/pdf/load";
import { pdfResponse, renderDocumentPdf } from "@/pdf/render";
import { loadSaleDeal, paymentModeLabel } from "@/pdf/sale-context";

export const runtime = "nodejs";

const refuse = (message: string, status: number) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/** Print one receipt. A reversed or bounced receipt still prints, and says so on its face. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  await getCurrentUser();
  const { paymentId } = await params;

  try {
    const supabase = await createClient();
    const { data: p } = await supabase.from("payments").select("*").eq("id", paymentId).maybeSingle();
    if (!p) return refuse("Receipt not found, or you do not have access to it.", 404);

    const [loaded, base] = await Promise.all([loadSaleDeal(p.sale_id, todayPK()), loadDocContextBase(p.project_id)]);
    if (!loaded || !base) return refuse("The sale for this receipt could not be loaded.", 404);

    const status =
      p.status === "reversed"
        ? `REVERSED - NOT VALID (${p.reversal_reason ?? "no reason recorded"})`
        : p.instrument_status === "bounced"
          ? `BOUNCED - NOT VALID (${p.bounced_reason ?? "no reason recorded"})`
          : p.instrument_status === "pending"
            ? "Subject to realization of the instrument"
            : "Received";

    const { letterheadPath, ...ctxBase } = base;
    const layout = layoutFor(request.nextUrl.searchParams.get("mode"), base.settings);
    const buffer = await renderDocumentPdf(
      {
        ...ctxBase,
        ...loaded.deal,
        date: p.received_on,
        docType: "payment_receipt",
        template: { doc_type: "payment_receipt", version: 1, title: "PAYMENT RECEIPT", ref_prefix: "RCPT", sections: [] },
        layout,
        refNo: p.receipt_no,
        ndcPurpose: null,
        verifyUrl: null,
        qrDataUrl: null,
        receipt: {
          amount: String(p.amount),
          mode: paymentModeLabel(p.mode),
          bank: p.bank_name,
          instrumentNo: p.instrument_no,
          instrumentDate: p.instrument_date,
          status,
        },
      },
      layout.mode === "letterhead" ? await loadLetterhead(letterheadPath) : null,
    );
    return pdfResponse(buffer, `${p.receipt_no}.pdf`);
  } catch (e) {
    console.error("[pdf/receipt]", paymentId, e);
    return refuse(`The receipt could not be generated: ${(e as Error).message}`, 500);
  }
}
