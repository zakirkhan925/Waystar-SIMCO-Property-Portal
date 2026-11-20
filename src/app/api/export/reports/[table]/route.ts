import type { NextRequest } from "next/server";
import { PAYMENTS_ROLES } from "@/features/payments/filters";
import { parseReportFilters } from "@/features/reports/filters";
import { loadReports } from "@/features/reports/queries";
import { reportTables } from "@/features/reports/tables";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { csvResponse, toCsv } from "@/lib/csv";
import { todayPK } from "@/lib/dates";

export async function GET(request: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const user = await getCurrentUser();
  if (!hasRole(user, ...PAYMENTS_ROLES)) return new Response("Access denied.", { status: 403 });

  const { table } = await params;
  const filters = parseReportFilters(Object.fromEntries(request.nextUrl.searchParams));
  const report = reportTables(await loadReports(filters)).find(({ id }) => id === table);
  if (!report) return new Response("Report not found.", { status: 404 });

  const rows = report.rows.map((row) => row.map((value) => typeof value === "object" ? value.toFixed(2) : value));
  return csvResponse(`report-${table}-${todayPK()}.csv`, toCsv(report.headers, rows));
}
