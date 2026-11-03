import { createClient } from "@/lib/supabase/server";

/** Possession, transfers and the cancellation attached to one sale. */
export async function getSaleHistory(saleId: string) {
  const supabase = await createClient();
  const [{ data: possession }, { data: transfers }, { data: cancellation }] = await Promise.all([
    supabase.from("possessions").select("*").eq("sale_id", saleId).is("deleted_at", null).maybeSingle(),
    supabase.from("transfers").select("*").eq("sale_id", saleId).order("transfer_date", { ascending: false }),
    supabase.from("cancellations").select("*").eq("sale_id", saleId).maybeSingle(),
  ]);
  return { possession, transfers: transfers ?? [], cancellation };
}

type RefundStatus = "pending_resale" | "payable" | "paid" | "waived";
export type RefundFilters = { status?: RefundStatus; projectId?: string };

export async function listRefunds(f: RefundFilters = {}) {
  const supabase = await createClient();
  let q = supabase.from("v_refunds_due").select("*");
  if (f.status) q = q.eq("refund_status", f.status);
  if (f.projectId) q = q.eq("project_id", f.projectId);
  const { data } = await q.order("refund_due_date", { ascending: true, nullsFirst: false });
  return data ?? [];
}

export type RefundRow = Awaited<ReturnType<typeof listRefunds>>[number];

/** Totals for the refunds screen header. */
export async function refundTotals() {
  const rows = await listRefunds();
  const sum = (pred: (r: RefundRow) => boolean) =>
    rows.filter(pred).reduce((n, r) => n + Number(r.refund_due ?? 0), 0);
  return {
    payable: sum((r) => r.refund_status === "payable"),
    awaitingResale: sum((r) => r.refund_status === "pending_resale"),
    paid: sum((r) => r.refund_status === "paid"),
    overdue: sum((r) => r.refund_status === "payable" && Number(r.days_overdue ?? 0) > 0),
    count: rows.length,
  };
}
