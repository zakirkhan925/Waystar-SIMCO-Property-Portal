import "server-only";
import { listPaymentReportRows } from "@/features/payments/queries";
import { recoverySummary } from "@/features/recoveries/queries";
import { listProjectsBrief } from "@/features/users/queries";
import { readBatches } from "@/lib/query-batches";
import { createClient } from "@/lib/supabase/server";
import { aggregateCollections, aggregateProjectReports, aggregateRefunds } from "./aggregation";
import type { ReportFilters } from "./filters";

export async function loadReports(filters: ReportFilters) {
  const supabase = await createClient();
  const { project, from, to } = filters;
  const inPeriod = (date: string | null) => date !== null &&
    (from === "any" || date >= from) && (to === "any" || date <= to);
  const [allProjects, units, sales, cancellations, transfers, refunds, payments, recoveries] = await Promise.all([
    listProjectsBrief(),
    readBatches((start, end) => {
      let query = supabase.from("units").select("project_id, status, base_price::text").is("deleted_at", null);
      if (project) query = query.eq("project_id", project);
      return query.order("id").range(start, end);
    }),
    readBatches((start, end) => {
      let query = supabase.from("sales").select("project_id, final_price::text").is("deleted_at", null);
      if (project) query = query.eq("project_id", project);
      if (from !== "any") query = query.gte("booking_date", from);
      if (to !== "any") query = query.lte("booking_date", to);
      return query.order("id").range(start, end);
    }),
    readBatches((start, end) => {
      let query = supabase.from("cancellations").select("project_id");
      if (project) query = query.eq("project_id", project);
      if (from !== "any") query = query.gte("cancelled_on", from);
      if (to !== "any") query = query.lte("cancelled_on", to);
      return query.order("id").range(start, end);
    }),
    readBatches((start, end) => {
      let query = supabase.from("transfers").select("project_id");
      if (project) query = query.eq("project_id", project);
      if (from !== "any") query = query.gte("transfer_date", from);
      if (to !== "any") query = query.lte("transfer_date", to);
      return query.order("id").range(start, end);
    }),
    readBatches((start, end) => {
      let query = supabase.from("cancellations").select("refund_status, refund_due::text, refunded_on").neq("refund_status", "waived");
      if (project) query = query.eq("project_id", project);
      return query.order("id").range(start, end);
    }),
    listPaymentReportRows(filters),
    recoverySummary(project),
  ]);

  const projects = allProjects.filter(({ id }) => !project || id === project);
  return {
    allProjects,
    projects: aggregateProjectReports(projects, { units, sales, cancellations, transfers }),
    collections: aggregateCollections(projects, payments),
    recoveries,
    refunds: aggregateRefunds(refunds.filter((row) => row.refund_status !== "paid" || inPeriod(row.refunded_on))),
  };
}
