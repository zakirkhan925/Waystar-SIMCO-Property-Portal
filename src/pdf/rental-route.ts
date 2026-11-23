import "server-only";

import type { NextRequest } from "next/server";
import { createElement } from "react";
import { z } from "zod";
import { getLease } from "@/features/rentals/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { todayPK } from "@/lib/dates";
import { readBatches } from "@/lib/query-batches";
import { createClient } from "@/lib/supabase/server";
import { layoutFor } from "./letterhead";
import { loadDocContextBase, loadLetterhead } from "./load";
import { RentalDocumentPdf, RENTAL_COMPANY, type RentalDocument } from "./rental-documents";
import { pdfResponse, renderPdf } from "./render";
import { issueDocument } from "./verification";

const templates = {
  rent_receipt: { title: "RENT RECEIPT", prefix: "RENT" },
  rent_invoice: { title: "RENT INVOICE", prefix: "RINV" },
  lease_agreement: { title: "LEASE SUMMARY", prefix: "LSE" },
  owner_statement: { title: "OWNER STATEMENT", prefix: "LSE" },
};

const refuse = (message: string, status: number) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

async function loadRentalDocument(type: RentalDocument["type"], id: string) {
  const supabase = await createClient();
  if (type === "rent_receipt") {
    const { data: payment, error } = await supabase.from("v_rent_payment_totals").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return payment?.lease_id && payment.receipt_no
      ? { leaseId: payment.lease_id, refNo: payment.receipt_no, document: { type, payment } as const } : null;
  }
  if (type === "rent_invoice") {
    const { data: invoice, error } = await supabase.from("v_rent_invoice_balances").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return invoice?.lease_id && invoice.invoice_no
      ? { leaseId: invoice.lease_id, refNo: invoice.invoice_no, document: { type, invoice } as const } : null;
  }
  if (type === "owner_statement") {
    const [balance, payouts] = await Promise.all([
      supabase.from("v_lease_ledger").select("*").eq("lease_id", id).maybeSingle(),
      readBatches((from, to) => supabase.from("owner_payouts").select("*").eq("lease_id", id)
        .order("paid_on").order("id").range(from, to)),
    ]);
    if (balance.error) throw balance.error;
    return balance.data ? { leaseId: id, refNo: null, document: { type, ledger: balance.data, payouts } as const } : null;
  }
  return { leaseId: id, refNo: null, document: { type } as const };
}

export async function rentalPdf(request: NextRequest, type: RentalDocument["type"], id: string) {
  await getCurrentUser();
  if (!z.uuid().safeParse(id).success) return refuse("Rental record not found.", 404);
  try {
    const loaded = await loadRentalDocument(type, id);
    const lease = loaded && await getLease(loaded.leaseId);
    if (!loaded || !lease) return refuse("Rental record not found, or you do not have access to it.", 404);
    const base = await loadDocContextBase(lease.project_id);
    if (!base) return refuse("The rental project could not be loaded.", 404);

    const refNo = loaded.refNo ?? lease.agreement_no;
    const verification = type === "owner_statement" ? { verifyUrl: null, qrDataUrl: null } : await issueDocument({
      docType: type, refNo, projectId: lease.project_id, leaseId: lease.id,
      rentInvoiceId: type === "rent_invoice" ? id : undefined,
      rentPaymentId: type === "rent_receipt" ? id : undefined,
    });
    const template = templates[type];
    const layout = layoutFor(request.nextUrl.searchParams.get("mode"), base.settings);
    const ctx = {
      ...base,
      company: { ...base.company, name: RENTAL_COMPANY },
      settings: { ...base.settings, marketed_by: RENTAL_COMPANY },
      template: { doc_type: type, title: template.title, version: 1, ref_prefix: template.prefix, sections: [] },
      refNo, layout, date: todayPK(), specimen: false, ...verification,
    };
    const letterhead = layout.mode === "letterhead" ? await loadLetterhead(base.letterheadPath) : null;
    const pdf = await renderPdf(
      createElement(RentalDocumentPdf, { ctx, lease, document: loaded.document }) as Parameters<typeof renderPdf>[0],
      ctx,
      letterhead,
    );
    return pdfResponse(pdf, `${type === "owner_statement" ? "owner-statement-" : ""}${refNo}.pdf`);
  } catch (error) {
    console.error("[pdf/rentals]", type, id, error);
    return refuse("The rental document could not be generated. Please try again or contact support.", 500);
  }
}
