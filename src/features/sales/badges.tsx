import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";
import { INSTALLMENT_STATUS_LABELS, SALE_STATUS_LABELS } from "./schemas";

const PILL = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

const SALE_STYLES: Record<Enums<"sale_status">, string> = {
  booked: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800",
  active: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
  completed: "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800",
  cancelled: "bg-zinc-200 text-zinc-700 border-zinc-400 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600",
  transferred: "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800",
};

const INSTALLMENT_STYLES: Record<Enums<"installment_status">, string> = {
  pending: "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600",
  partially_paid: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
  paid: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
  overdue: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800",
  waived: "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800",
};

export function SaleStatusBadge({ status, className }: { status: Enums<"sale_status">; className?: string }) {
  return <span className={cn(PILL, SALE_STYLES[status], className)}>{SALE_STATUS_LABELS[status]}</span>;
}

export function InstallmentStatusBadge({ status, className }: { status: Enums<"installment_status">; className?: string }) {
  return <span className={cn(PILL, INSTALLMENT_STYLES[status], className)}>{INSTALLMENT_STATUS_LABELS[status]}</span>;
}

/** Where a receipt stands: cleared, waiting on the bank, bounced, or reversed. */
export function ReceiptStatusBadge({
  status,
  instrument,
  className,
}: {
  status: Enums<"record_status">;
  instrument: Enums<"instrument_status">;
  className?: string;
}) {
  if (status === "reversed") return <span className={cn(PILL, INSTALLMENT_STYLES.waived, className)}>Reversed</span>;
  if (instrument === "bounced") return <span className={cn(PILL, INSTALLMENT_STYLES.overdue, className)}>Bounced</span>;
  if (instrument === "pending") return <span className={cn(PILL, INSTALLMENT_STYLES.partially_paid, className)}>Awaiting clearance</span>;
  return <span className={cn(PILL, INSTALLMENT_STYLES.paid, className)}>Cleared</span>;
}

export function AgingBadge({ bucket, className }: { bucket: string; className?: string }) {
  const style =
    bucket === "not_due"
      ? INSTALLMENT_STYLES.pending
      : bucket === "0_30"
        ? INSTALLMENT_STYLES.partially_paid
        : INSTALLMENT_STYLES.overdue;
  const label =
    { not_due: "Not due", "0_30": "1–30 days", "31_60": "31–60 days", "61_90": "61–90 days", "90_plus": "90+ days" }[bucket] ??
    bucket;
  return <span className={cn(PILL, style, className)}>{label}</span>;
}
