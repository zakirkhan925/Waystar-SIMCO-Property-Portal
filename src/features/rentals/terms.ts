import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { toDecimal, type MoneyInput } from "@/lib/money";
import type { Enums } from "@/types/database";

export const LEASE_STATUS_LABELS: Record<Enums<"lease_status">, string> = {
  draft: "Draft", active: "Active", expired: "Expired", terminated: "Terminated", renewed: "Renewed",
};

export function rentSchedule(start: string, monthlyRent: MoneyInput, increment: MoneyInput, months: number) {
  const first = startOfMonth(parseISO(start));
  const base = toDecimal(monthlyRent);
  const multiplier = toDecimal(increment).div(100).add(1);
  return Array.from({ length: months }, (_, month) => ({
    period: format(addMonths(first, month), "yyyy-MM-dd"),
    rent: base.mul(multiplier.pow(Math.floor(month / 12))).toFixed(0),
  }));
}

export function landlordBalance(collected: MoneyInput, commission: MoneyInput, payouts: MoneyInput) {
  return toDecimal(collected).minus(toDecimal(commission)).minus(toDecimal(payouts));
}

export function nextRentIncrease(start: string, end: string, today: string) {
  const first = parseISO(start);
  const years = Math.max(1, Number(today.slice(0, 4)) - first.getFullYear());
  const anniversary = (year: number) => format(addMonths(first, year * 12), "yyyy-MM-dd");
  const candidate = anniversary(years) > today ? anniversary(years) : anniversary(years + 1);
  return candidate <= end ? candidate : null;
}

export const paymentModeLabels = {
  cash: "Cash", cheque: "Cheque", pay_order: "Pay order", bank_transfer: "Bank transfer", online: "Online",
};
