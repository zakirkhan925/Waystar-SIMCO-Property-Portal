import { describe, expect, it } from "vitest";
import { aggregateCollections, aggregateProjectReports, aggregateRefunds } from "@/features/reports/aggregation";

const projects = [{ id: "a", name: "Project A" }, { id: "b", name: "Project B" }];

describe("report aggregation", () => {
  it("counts units by status and values only available inventory, with separate sale events", () => {
    const [a, b] = aggregateProjectReports(projects, {
      units: [
        { project_id: "a", status: "available", base_price: "0.10" },
        { project_id: "a", status: "available", base_price: "0.20" },
        { project_id: "a", status: "on_hold", base_price: "1000.00" },
        { project_id: "b", status: "sold", base_price: "500.00" },
      ],
      sales: [{ project_id: "a", final_price: "1200.99" }, { project_id: "a", final_price: "800.01" }],
      cancellations: [{ project_id: "a" }],
      transfers: [{ project_id: "b" }],
    });
    expect(a).toMatchObject({ units: 3, inventory: { available: 2, on_hold: 1 }, bookings: 2, cancellations: 1 });
    expect(a.listValue.toFixed(2)).toBe("0.30");
    expect(a.saleValue.toFixed(2)).toBe("2001.00");
    expect(b).toMatchObject({ units: 1, inventory: { sold: 1 }, transfers: 1 });
    expect(b.listValue.toFixed(2)).toBe("0.00");
  });

  it("groups cleared collections and counts reversed, bounced and pending receipts separately", () => {
    const common = { project_id: "a", mode: "cheque", amount: "0.20", status: "valid" } as const;
    const { statuses, byProject, byMode } = aggregateCollections(projects, [
      { ...common, mode: "cash", amount: "0.10", instrument_status: "not_applicable" },
      { ...common, instrument_status: "cleared" },
      { ...common, instrument_status: "pending" },
      { ...common, instrument_status: "bounced" },
      { ...common, status: "reversed", instrument_status: "bounced" },
    ]);
    expect(statuses.cleared.count).toBe(2);
    expect(statuses.cleared.amount.toFixed(2)).toBe("0.30");
    expect(byProject[0].amount.toFixed(2)).toBe("0.30");
    expect(byMode.filter(({ count }) => count).map(({ amount }) => amount.toFixed(2))).toEqual(["0.10", "0.20"]);
    expect([statuses.pending, statuses.bounced, statuses.reversed].map(({ count }) => count)).toEqual([1, 1, 1]);
  });

  it("keeps refund statuses separate and excludes waived refunds", () => {
    const refunds = aggregateRefunds([
      { refund_status: "pending_resale", refund_due: "10.50" },
      { refund_status: "payable", refund_due: "20.00" },
      { refund_status: "paid", refund_due: "30.25" },
      { refund_status: "waived", refund_due: "40.00" },
    ]);
    expect(refunds.map(({ count, amount }) => [count, amount.toFixed(2)]))
      .toEqual([[1, "10.50"], [1, "20.00"], [1, "30.25"]]);
  });
});
