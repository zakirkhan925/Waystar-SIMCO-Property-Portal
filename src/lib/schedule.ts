import Decimal from "decimal.js";
import { addDays, addMonths, format, parseISO } from "date-fns";
import type { Enums } from "@/types/database";

/**
 * Preview of the installment schedule, mirroring private.build_schedule() in
 * migration 20261029000200. It exists so the booking wizard can show the schedule
 * before anything is saved; the database remains the source of truth, and
 * tests/schedule.test.ts checks the two agree.
 */
export type SchedulePlan = {
  finalPrice: Decimal.Value;
  bookingDate: string; // YYYY-MM-DD
  planKind: Enums<"plan_kind">;
  downPaymentPct: Decimal.Value;
  installmentPct: Decimal.Value;
  possessionPct: Decimal.Value;
  tenureMonths?: number | null;
  frequency?: Enums<"plan_frequency"> | null;
  firstInstallmentDate?: string | null;
  /** Paid at booking, part of the down payment. */
  bookingAmount?: Decimal.Value | null;
  /** Days the buyer has to pay the rest of the down payment; null = not split. */
  downPaymentBalanceDays?: number | null;
};

export type ScheduleLine = {
  seq: number;
  type: Enums<"installment_type">;
  label: string;
  dueDate: string | null;
  amount: string; // numeric string, never a float
  pct: string;
};

export const FREQUENCY_MONTHS: Record<Enums<"plan_frequency">, number> = {
  monthly: 1,
  quarterly: 3,
  bi_annual: 6,
  annual: 12,
};

const FREQUENCY_LABEL: Record<Enums<"plan_frequency">, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  bi_annual: "Bi-Annual",
  annual: "Annual",
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function buildSchedule(plan: SchedulePlan): ScheduleLine[] {
  const final = new Decimal(plan.finalPrice || 0);
  if (final.lte(0)) return [];

  const booking = parseISO(plan.bookingDate);
  const down = final.times(plan.downPaymentPct || 0).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const possession = final.times(plan.possessionPct || 0).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const instTotal = final.minus(down).minus(possession);

  const lines: ScheduleLine[] = [];
  const pct = (amount: Decimal) => amount.times(100).div(final).toDecimalPlaces(2).toString();
  const push = (type: ScheduleLine["type"], label: string, dueDate: string | null, amount: Decimal) =>
    lines.push({ seq: lines.length + 1, type, label, dueDate, amount: amount.toFixed(2), pct: pct(amount) });

  const bookingAmount = plan.bookingAmount ? new Decimal(plan.bookingAmount) : null;
  const splitDown =
    bookingAmount !== null &&
    bookingAmount.gt(0) &&
    bookingAmount.lt(down) &&
    plan.downPaymentBalanceDays !== null &&
    plan.downPaymentBalanceDays !== undefined;

  if (splitDown) {
    push("down_payment", "Down Payment (at Booking)", plan.bookingDate, bookingAmount!);
    push("down_payment", "Down Payment (balance)", iso(addDays(booking, plan.downPaymentBalanceDays!)), down.minus(bookingAmount!));
  } else {
    push("down_payment", plan.planKind === "full_cash" ? "Full Payment" : "Down Payment (at Booking)", plan.bookingDate, down);
  }

  if (plan.planKind === "installment" && instTotal.gt(0) && plan.frequency && plan.tenureMonths) {
    const months = FREQUENCY_MONTHS[plan.frequency];
    const n = Math.max(1, Math.trunc(plan.tenureMonths / months));
    const first = plan.firstInstallmentDate ? parseISO(plan.firstInstallmentDate) : addMonths(booking, months);
    const each = instTotal.div(n).toDecimalPlaces(2, Decimal.ROUND_DOWN);

    let allocated = new Decimal(0);
    for (let i = 1; i <= n; i++) {
      // equal installments; the rounding difference lands on the last one
      const amount = i === n ? instTotal.minus(allocated) : each;
      allocated = allocated.plus(amount);
      push(
        "installment",
        `Installment ${i} of ${n} (${FREQUENCY_LABEL[plan.frequency]})`,
        iso(addMonths(first, (i - 1) * months)),
        amount,
      );
    }
  }

  if (possession.gt(0)) {
    push("possession", "On Possession", null, possession); // payable when possession is announced
  }
  return lines;
}

export function scheduleTotal(lines: ScheduleLine[]): string {
  return lines.reduce((sum, l) => sum.plus(l.amount), new Decimal(0)).toFixed(2);
}
