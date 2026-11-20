import { describe, expect, it } from "vitest";
import { summarizeStatement } from "@/pdf/statement";

describe("statement summary", () => {
  const today = "2026-11-20";
  const installment = {
    seq: 1, label: "Installment 1", due_date: "2026-11-19",
    amount_due: 1000, amount_paid: 0, waived_amount: 0, late_fee: 0, late_fee_paid: 0,
  };
  const cleared = { amount: 250, status: "valid", instrument_status: "cleared" } as const;

  it.each([
    { name: "nothing paid", payments: [], paid: 0, expected: "1000.00" },
    { name: "part paid", payments: [cleared], paid: 250, expected: "750.00" },
    { name: "fully paid", payments: [{ ...cleared, amount: 1000 }], paid: 1000, expected: "0.00" },
    { name: "bounced", payments: [{ ...cleared, instrument_status: "bounced" }], paid: 0, expected: "1000.00" },
    { name: "reversed", payments: [{ ...cleared, status: "reversed" }], paid: 0, expected: "1000.00" },
    { name: "pending", payments: [{ ...cleared, instrument_status: "pending" }], paid: 0, expected: "1000.00" },
  ] as const)("$name", ({ payments, paid, expected }) => {
    const summary = summarizeStatement("1000.00", [...payments], [{ ...installment, amount_paid: paid }], today);
    expect(summary.received).toBe(paid.toFixed(2));
    expect(summary.outstanding).toBe(expected);
    expect(summary.overdue).toBe(expected);
  });

  it("accounts for waived principal and cleared late-fee payments separately", () => {
    const summary = summarizeStatement("1000.00", [{ ...cleared, amount: 950 }], [{
      ...installment, amount_paid: 900, waived_amount: 100, late_fee: 75, late_fee_paid: 50,
    }], today);
    expect(summary).toMatchObject({
      received: "950.00", receivedForSale: "900.00", waived: "100.00", outstanding: "0.00",
      feesAccrued: "75.00", feesOutstanding: "25.00", overdue: "25.00",
    });
  });
});
