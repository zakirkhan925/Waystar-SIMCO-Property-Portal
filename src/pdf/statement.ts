import Decimal from "decimal.js";
import { toDecimal } from "@/lib/money";
import type { Tables } from "@/types/database";

type Payment = Pick<Tables<"payments">, "amount" | "status" | "instrument_status">;
type Installment = Pick<Tables<"installments">,
  "seq" | "label" | "due_date" | "amount_due" | "amount_paid" | "waived_amount" | "late_fee" | "late_fee_paid"
>;

export function statementPaymentStatus(payment: Payment) {
  if (payment.status === "reversed") return "Reversed";
  if (payment.instrument_status === "bounced") return "Bounced";
  return payment.instrument_status === "pending" ? "Pending" : "Cleared";
}

export function summarizeStatement(
  price: string,
  payments: Payment[],
  installments: Installment[],
  today: string,
) {
  const received = payments.reduce(
    (sum, payment) => statementPaymentStatus(payment) === "Cleared" ? sum.plus(payment.amount) : sum,
    toDecimal(0),
  );
  let overdue = toDecimal(0);
  let feesAccrued = toDecimal(0);
  let feesPaid = toDecimal(0);
  let waived = toDecimal(0);
  let nextDueDate: string | null = null;
  let nextDueAmount = toDecimal(0);

  const schedule = installments.map((row) => {
    const due = toDecimal(row.amount_due).minus(row.waived_amount).plus(row.late_fee);
    const paid = toDecimal(row.amount_paid).plus(row.late_fee_paid);
    const balance = Decimal.max(0, due.minus(paid));
    const daysOverdue = row.due_date && balance.gt(0)
      ? Math.max(0, (Date.parse(today) - Date.parse(row.due_date)) / 86_400_000)
      : 0;
    feesAccrued = feesAccrued.plus(row.late_fee);
    feesPaid = feesPaid.plus(row.late_fee_paid);
    waived = waived.plus(row.waived_amount);
    if (daysOverdue > 0) overdue = overdue.plus(balance);
    if (row.due_date && row.due_date >= today && balance.gt(0)) {
      if (!nextDueDate || row.due_date < nextDueDate) {
        nextDueDate = row.due_date;
        nextDueAmount = balance;
      } else if (row.due_date === nextDueDate) {
        nextDueAmount = nextDueAmount.plus(balance);
      }
    }
    return {
      no: row.seq,
      label: row.label,
      dueDate: row.due_date,
      due: due.toFixed(2),
      paid: paid.toFixed(2),
      balance: balance.toFixed(2),
      status: balance.isZero() ? "Paid" : daysOverdue > 0 ? `Overdue (${daysOverdue}d)` : paid.gt(0) ? "Partly paid" : "Due",
    };
  });

  // Late fees are a separate debt. Only the principal portion of cleared receipts reduces the sale price.
  const receivedForSale = received.minus(feesPaid);
  return {
    received: received.toFixed(2),
    receivedForSale: receivedForSale.toFixed(2),
    outstanding: toDecimal(price).minus(waived).minus(receivedForSale).toFixed(2),
    waived: waived.toFixed(2),
    overdue: overdue.toFixed(2),
    feesAccrued: feesAccrued.toFixed(2),
    feesOutstanding: feesAccrued.minus(feesPaid).toFixed(2),
    nextDue: nextDueDate ? { date: nextDueDate, amount: nextDueAmount.toFixed(2) } : null,
    schedule,
  };
}
