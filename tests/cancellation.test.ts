import { describe, expect, it } from "vitest";
import { summarizeCancellation } from "@/pdf/cancellation";

describe("cancellation and refund letter", () => {
  const cancellation = {
    sale_price: 3740000, amount_received: 1122000, deduction_pct: 20, deduction_amount: 748000,
    refund_due_date: "2026-11-22", refunded_on: "2026-11-24", refund_reference: "REF-12",
  };

  it.each([
    ["pending_resale", "The refund will become payable after the plot is re-sold."],
    ["payable", "The refund is payable from 22-Nov-2026."],
    ["paid", "Refunded on 24-Nov-2026, reference REF-12."],
    ["waived", "No refund is due."],
  ] as const)("prints the %s wording", (refund_status, wording) => {
    expect(summarizeCancellation({ ...cancellation, refund_status }).refundWording).toBe(wording);
  });

  it("uses the recorded deduction and floors the refund at zero", () => {
    const row = { ...cancellation, refund_status: "pending_resale" } as const;
    expect(summarizeCancellation(row)).toMatchObject({
      salePrice: "3740000.00", received: "1122000.00",
      deductionPct: "20", deduction: "748000.00", refundDue: "374000.00",
    });
    expect(summarizeCancellation({ ...row, amount_received: 500000 }).refundDue).toBe("0.00");
  });
});
