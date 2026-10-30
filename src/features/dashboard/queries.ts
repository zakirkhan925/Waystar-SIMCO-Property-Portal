import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayPK } from "@/lib/dates";

/** Sales, collections and receivables for the dashboard. */
export async function getSalesOverview() {
  const supabase = await createClient();
  const today = todayPK();
  const in30 = new Date(`${today}T00:00:00`);
  in30.setDate(in30.getDate() + 30);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [{ data: sales }, { data: receivables }, { data: upcoming }, { data: collections }, { data: recent }] =
    await Promise.all([
      supabase.from("v_sale_summary").select("status, final_price, total_paid, balance, overdue_amount, cancellation_due"),
      supabase.from("v_receivables").select("aging_bucket, outstanding"),
      supabase
        .from("v_receivables")
        .select("installment_id, unit_no, project_code, label, due_date, outstanding, client_name, sale_id")
        .eq("aging_bucket", "not_due")
        .lte("due_date", in30.toISOString().slice(0, 10))
        .order("due_date")
        .limit(8),
      // every cleared receipt this year, for the collections-by-month chart
      supabase
        .from("payments")
        .select("received_on, amount, status, instrument_status")
        .gte("received_on", `${today.slice(0, 4)}-01-01`)
        .order("received_on"),
      supabase
        .from("v_sale_summary")
        .select("sale_id, unit_no, project_code, primary_client_name, final_price, booking_date, status")
        .order("booking_date", { ascending: false })
        .limit(6),
    ]);

  const live = (sales ?? []).filter((s) => s.status === "booked" || s.status === "active" || s.status === "completed");
  const cleared = (collections ?? []).filter(
    (p) => p.status === "valid" && (p.instrument_status === "cleared" || p.instrument_status === "not_applicable"),
  );

  const byMonth = new Map<string, number>();
  for (const p of cleared) {
    const key = p.received_on.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(p.amount));
  }

  const overdueTotal = (receivables ?? [])
    .filter((r) => r.aging_bucket !== "not_due")
    .reduce((n, r) => n + Number(r.outstanding ?? 0), 0);

  return {
    saleCount: live.length,
    saleValue: live.reduce((n, s) => n + Number(s.final_price ?? 0), 0),
    collected: live.reduce((n, s) => n + Number(s.total_paid ?? 0), 0),
    receivable: live.reduce((n, s) => n + Number(s.balance ?? 0), 0),
    overdue: overdueTotal,
    flagged: live.filter((s) => s.cancellation_due).length,
    collectedThisMonth: cleared
      .filter((p) => p.received_on >= monthStart)
      .reduce((n, p) => n + Number(p.amount), 0),
    collectionsByMonth: [...byMonth.entries()].map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month)),
    upcoming: upcoming ?? [],
    recentSales: recent ?? [],
  };
}
