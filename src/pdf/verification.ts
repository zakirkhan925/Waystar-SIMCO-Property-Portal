import "server-only";
import { createClient } from "@/lib/supabase/server";
import { qrDataUrl } from "./render";

export async function issueDocument({
  docType, refNo, saleId, projectId, paymentId, transferId,
}: {
  docType: string;
  refNo: string;
  saleId: string;
  projectId: string;
  paymentId?: string;
  transferId?: string;
}) {
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("issue_document", {
    p: { doc_type: docType, ref_no: refNo, sale_id: saleId, project_id: projectId, payment_id: paymentId, transfer_id: transferId },
  });
  if (error || !token) {
    console.error("[pdf/verification]", docType, refNo, error);
    throw new Error("The verification code could not be issued.");
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://crm.waystarmarketing.com";
  const verifyUrl = new URL(`/verify/${token}`, site).href;
  return { verifyUrl, qrDataUrl: await qrDataUrl(verifyUrl, 4) };
}
