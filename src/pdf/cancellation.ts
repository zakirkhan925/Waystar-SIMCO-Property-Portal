import Decimal from "decimal.js";
import { formatDate } from "@/lib/dates";
import { toDecimal } from "@/lib/money";
import type { Tables } from "@/types/database";

type Cancellation = Pick<Tables<"cancellations">,
  "amount_received" | "sale_price" | "deduction_pct" | "deduction_amount" |
  "refund_status" | "refund_due_date" | "refunded_on" | "refund_reference"
>;

function refundWording(row: Cancellation, refundDue: Decimal) {
  // Nothing to pay back: say so plainly, rather than promising a refund "after re-sale".
  if (refundDue.isZero() && row.refund_status !== "paid") {
    return "No refund is due, because the deduction is equal to or more than the amount received.";
  }
  switch (row.refund_status) {
    case "pending_resale":
      return "The refund will become payable after the plot is re-sold.";
    case "payable":
      return row.refund_due_date
        ? `The refund is payable from ${formatDate(row.refund_due_date)}.`
        : "The refund is payable.";
    case "paid":
      return `Refunded on ${row.refunded_on ? formatDate(row.refunded_on) : "an unrecorded date"}, reference ${row.refund_reference ?? "not recorded"}.`;
    case "waived":
      return "No refund is due.";
  }
}

export function summarizeCancellation(row: Cancellation) {
  const received = toDecimal(row.amount_received);
  const deduction = toDecimal(row.deduction_amount);
  const refundDue = Decimal.max(received.minus(deduction), 0);
  return {
    salePrice: toDecimal(row.sale_price).toFixed(2),
    received: received.toFixed(2),
    deductionPct: toDecimal(row.deduction_pct).toString(),
    deduction: deduction.toFixed(2),
    refundDue: refundDue.toFixed(2),
    refundWording: refundWording(row, refundDue),
  };
}
