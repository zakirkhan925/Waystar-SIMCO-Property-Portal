import type { NextRequest } from "next/server";
import Decimal from "decimal.js";
import { getCurrentUser } from "@/lib/auth/session";
import { todayPK } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { layoutFor } from "@/pdf/letterhead";
import { loadDocContextBase, loadLetterhead } from "@/pdf/load";
import { pdfResponse, renderDocumentPdf } from "@/pdf/render";
import { loadSaleDeal } from "@/pdf/sale-context";
import { issueDocument } from "@/pdf/verification";

export const runtime = "nodejs";

const refuse = (message: string, status: number) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: NextRequest, { params }: { params: Promise<{ transferId: string }> }) {
  await getCurrentUser();
  const { transferId } = await params;

  try {
    const supabase = await createClient();
    const { data: transfer, error } = await supabase.from("transfers").select("*").eq("id", transferId).maybeSingle();
    if (error) throw error;
    if (!transfer) return refuse("Transfer not found, or you do not have access to it.", 404);

    // The numbered transfers identify successive owner groups even when two transfers share a date.
    const [loaded, base, prior, owners] = await Promise.all([
      loadSaleDeal(transfer.sale_id, todayPK()),
      loadDocContextBase(transfer.project_id),
      supabase.from("transfers").select("id").eq("sale_id", transfer.sale_id)
        .lt("transfer_no", transfer.transfer_no).order("transfer_no", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("unit_ownerships").select("transfer_id, valid_to, clients(full_name, cnic)")
        .eq("sale_id", transfer.sale_id).order("share_pct", { ascending: false }).order("client_id"),
    ]);
    if (prior.error) throw prior.error;
    if (owners.error) throw owners.error;
    if (!loaded || !base) return refuse("The booking for this transfer could not be loaded.", 404);

    const parties = (id: string | null) => (owners.data ?? []).flatMap((owner) =>
      owner.transfer_id === id && owner.clients &&
      (id === transferId || owner.valid_to === transfer.transfer_date)
        ? [{ name: owner.clients.full_name, cnic: owner.clients.cnic }]
        : [],
    );
    const previousOwners = parties(prior.data?.id ?? null);
    const newOwners = parties(transferId);
    if (!previousOwners.length || !newOwners.length) {
      return refuse("The ownership history for this transfer is incomplete or unavailable.", 404);
    }

    const { letterheadPath, ...ctxBase } = base;
    const layout = layoutFor(request.nextUrl.searchParams.get("mode"), base.settings);
    const refNo = transfer.transfer_no;
    const verification = await issueDocument({
      docType: "transfer_letter", refNo, saleId: transfer.sale_id, projectId: transfer.project_id, transferId,
    });
    const fee = new Decimal(transfer.transfer_fee);
    const buffer = await renderDocumentPdf(
      {
        ...ctxBase,
        ...loaded.deal,
        docType: "transfer_letter",
        template: { doc_type: "transfer_letter", version: 1, title: "TRANSFER LETTER", ref_prefix: "TRF", sections: [] },
        layout,
        refNo,
        ndcPurpose: null,
        ...verification,
        transfer: { previousOwners, newOwners, transferDate: transfer.transfer_date, fee: fee.gt(0) ? fee.toFixed(2) : null },
      },
      layout.mode === "letterhead" ? await loadLetterhead(letterheadPath) : null,
    );
    return pdfResponse(buffer, `${refNo}.pdf`);
  } catch (e) {
    console.error("[pdf/transfer]", transferId, e);
    return refuse("The transfer letter could not be generated. Please try again or contact support.", 500);
  }
}
