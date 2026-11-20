import { parsePaymentFilters } from "@/features/payments/filters";

export function parseReportFilters(input: Record<string, unknown>) {
  const { project, from, to } = input;
  return parsePaymentFilters({ project, from, to });
}

export type ReportFilters = ReturnType<typeof parseReportFilters>;
