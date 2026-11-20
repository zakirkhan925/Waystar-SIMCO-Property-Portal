import { z } from "zod";
import { todayPK } from "@/lib/dates";
import type { AppRole } from "@/lib/labels";
import type { Enums } from "@/types/database";
import { PAYMENT_MODE_LABELS } from "@/features/sales/schemas";

export const PAYMENTS_ROLES: AppRole[] = ["super_admin", "manager", "accounts", "viewer"];

export const PAYMENT_STATUS_LABELS = {
  cleared: "Cleared",
  pending: "Pending clearance",
  bounced: "Bounced",
  reversed: "Reversed",
} as const;

type PaymentStatus = keyof typeof PAYMENT_STATUS_LABELS;

export function paymentStatus(payment: {
  status: Enums<"record_status">;
  instrument_status: Enums<"instrument_status">;
}): PaymentStatus {
  if (payment.status === "reversed") return "reversed";
  if (payment.instrument_status === "not_applicable") return "cleared";
  return payment.instrument_status;
}

const dateFilter = z.union([z.iso.date(), z.literal("any")]).optional().catch(undefined);
const filterSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  project: z.uuid().optional().catch(undefined),
  from: dateFilter,
  to: dateFilter,
  mode: z.enum(Object.keys(PAYMENT_MODE_LABELS) as Enums<"payment_mode">[]).optional().catch(undefined),
  status: z.enum(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).optional().catch(undefined),
});

export function parsePaymentFilters(input: unknown, today = todayPK()) {
  const filters = filterSchema.parse(input);
  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    ...filters,
    from: filters.from ?? `${today.slice(0, 7)}-01`,
    to: filters.to ?? `${today.slice(0, 7)}-${lastDay}`,
  };
}

export type PaymentFilters = ReturnType<typeof parsePaymentFilters>;

export const paymentPagination = z.object({
  page: z.coerce.number().int().min(1).max(10_000_000).catch(1),
  size: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n)).catch(25),
});
