import "server-only";
import { createClient } from "@/lib/supabase/server";

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
  let q = supabase.from("v_receivables").select("aging_bucket, outstanding");
  if (projectId) q = q.eq("project_id", projectId);
  const { data } = await q;

  const empty = { not_due: 0, "0_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 };
  const totals: Record<string, number> = { ...empty };
  const counts: Record<string, number> = { ...empty };
  for (const r of data ?? []) {
    const b = r.aging_bucket ?? "not_due";
    totals[b] = (totals[b] ?? 0) + Number(r.outstanding ?? 0);
    counts[b] = (counts[b] ?? 0) + 1;
  }
  return { totals, counts };
}
