import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toDecimal } from "@/lib/money";
import { readBatches } from "@/lib/query-batches";

export type RecoveryBucket = "all" | "due_week" | "overdue" | "0_30" | "31_60" | "61_90" | "90_plus";

export async function listRecoveries(bucket: RecoveryBucket, projectId?: string, cap = 500) {
  const supabase = await createClient();
  let q = supabase.from("v_receivables").select("*");
  if (projectId) q = q.eq("project_id", projectId);

  if (bucket === "overdue") q = q.neq("aging_bucket", "not_due");
  else if (bucket === "due_week") {
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    q = q.eq("aging_bucket", "not_due").lte("due_date", in7.toISOString().slice(0, 10));
  } else if (bucket !== "all") q = q.eq("aging_bucket", bucket);

  const { data, error } = await q.order("due_date", { ascending: true }).limit(cap);
  if (error) throw error;
  return data ?? [];
}

export type RecoveryRow = Awaited<ReturnType<typeof listRecoveries>>[number];

/** Totals per aging bucket, for the summary strip. */
export async function recoverySummary(projectId?: string) {
  const supabase = await createClient();
  const rows = await readBatches((from, to) => {
    let query = supabase.from("v_receivables").select("aging_bucket, outstanding::text, late_fee_outstanding::text");
    if (projectId) query = query.eq("project_id", projectId);
    return query.order("installment_id").range(from, to);
  });
  const totals = { not_due: toDecimal(0), "0_30": toDecimal(0), "31_60": toDecimal(0), "61_90": toDecimal(0), "90_plus": toDecimal(0) };
  const counts = { not_due: 0, "0_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 };
  let lateCharges = toDecimal(0);
  for (const r of rows) {
    const b = r.aging_bucket ?? "not_due";
    if (!(b in totals)) throw new Error("Unknown receivables ageing bucket.");
    const bucket = b as keyof typeof totals;
    totals[bucket] = totals[bucket].plus(toDecimal(r.outstanding));
    counts[bucket] += 1;
    lateCharges = lateCharges.plus(toDecimal(r.late_fee_outstanding));
  }
  const overdue = totals["0_30"].plus(totals["31_60"]).plus(totals["61_90"]).plus(totals["90_plus"]);
  return { totals, counts, lateCharges, overdue, outstanding: overdue.plus(totals.not_due) };
}
