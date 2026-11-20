import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { todayPK } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { layoutFor } from "@/pdf/letterhead";
import { loadDocContextBase, loadLetterhead } from "@/pdf/load";
import { pdfResponse, renderDocumentPdf } from "@/pdf/render";
import { documentRef, loadSaleDeal, paymentModeLabel } from "@/pdf/sale-context";
import { statementPaymentStatus, summarizeStatement } from "@/pdf/statement";

export const runtime = "nodejs";

const refuse = (message: string, status: number) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: NextRequest, { params }: { params: Promise<{ saleId: string }> }) {
  await getCurrentUser();
  const { saleId } = await params;

  try {
    const today = todayPK();
    const loaded = await loadSaleDeal(saleId, today);
    if (!loaded) return refuse("Sale not found, or you do not have access to it.", 404);
    if (loaded.ledgerError) throw loaded.ledgerError;

    const cancelled = loaded.status === "cancelled";
    const supabase = await createClient();
    const [base, cancellation] = await Promise.all([
      loadDocContextBase(loaded.projectId),
      cancelled
        ? supabase.from("cancellations").select("cancelled_on").eq("sale_id", saleId).maybeSingle()
        : null,
    ]);
    if (!base) return refuse("The project for this statement could not be loaded.", 404);
    if (cancellation?.error) throw cancellation.error;

    const { letterheadPath, ...ctxBase } = base;
    const layout = layoutFor(request.nextUrl.searchParams.get("mode"), base.settings);
    const refNo = documentRef(loaded.bookingFormNo, "SOA");
    const buffer = await renderDocumentPdf(
      {
        ...ctxBase,
        ...loaded.deal,
        docType: "statement_of_account",
        template: { doc_type: "statement_of_account", version: 1, title: "STATEMENT OF ACCOUNT", ref_prefix: "SOA", sections: [] },
        layout,
        refNo,
        ndcPurpose: null,
        verifyUrl: null,
        qrDataUrl: null,
        statement: {
          ...summarizeStatement(loaded.deal.sale.totalPrice, loaded.payments, loaded.installments, today),
          cancelled,
          cancelledOn: cancellation?.data?.cancelled_on ?? null,
          paymentPlan: loaded.paymentPlanName ?? (loaded.deal.sale.planType === "full_cash" ? "Full payment" : "Installments"),
          payments: loaded.payments.map((payment) => ({
            date: payment.received_on,
            receiptNo: payment.receipt_no,
            mode: paymentModeLabel(payment.mode),
            instrumentNo: payment.instrument_no,
            amount: String(payment.amount),
            status: statementPaymentStatus(payment),
          })),
        },
      },
      layout.mode === "letterhead" ? await loadLetterhead(letterheadPath) : null,
    );
    return pdfResponse(buffer, `${refNo}.pdf`);
  } catch (e) {
    console.error("[pdf/statement]", saleId, e);
    return refuse("The statement could not be generated. Please try again or contact support.", 500);
  }
}
