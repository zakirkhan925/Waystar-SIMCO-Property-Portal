import { readFileSync } from "node:fs";
import { join } from "node:path";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { buildSchedule, scheduleTotal, type SchedulePlan } from "@/lib/schedule";
import type { Enums } from "@/types/database";

/**
 * The booking wizard previews the schedule in TypeScript; the database generates the real one.
 * These fixtures were exported from the seeded database, so the two must agree line for line.
 * Regenerate with the query in the Phase 2 notes if the generator ever changes.
 */
type Fixture = {
  booking_form_no: string;
  booking_date: string;
  final_price: string;
  plan_kind: Enums<"plan_kind">;
  down_payment_pct: string;
  installment_pct: string;
  possession_pct: string;
  tenure_months: number | null;
  frequency: Enums<"plan_frequency"> | null;
  booking_amount: string | null;
  first_installment_date: string | null;
  down_payment_balance_days: number | null;
  lines: { seq: number; type: string; label: string; dueDate: string | null; amount: string }[];
};

const fixtures = JSON.parse(readFileSync(join(__dirname, "fixtures-schedules.json"), "utf8")) as Fixture[];

const planFor = (f: Fixture): SchedulePlan => ({
  finalPrice: f.final_price,
  bookingDate: f.booking_date,
  planKind: f.plan_kind,
  downPaymentPct: f.down_payment_pct,
  installmentPct: f.installment_pct,
  possessionPct: f.possession_pct,
  tenureMonths: f.tenure_months,
  frequency: f.frequency,
  firstInstallmentDate: f.first_installment_date,
  bookingAmount: f.booking_amount,
  downPaymentBalanceDays: f.down_payment_balance_days,
});

describe("installment schedule preview", () => {
  it("has fixtures to check against", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures.map((f) => [f.booking_form_no, f] as const))(
    "matches the database for %s",
    (_name, f) => {
      const lines = buildSchedule(planFor(f));
      expect(lines.map((l) => ({ seq: l.seq, type: l.type, label: l.label, dueDate: l.dueDate, amount: l.amount }))).toEqual(
        f.lines.map((l) => ({ seq: l.seq, type: l.type, label: l.label, dueDate: l.dueDate, amount: l.amount })),
      );
    },
  );

  it.each(fixtures.map((f) => [f.booking_form_no, f] as const))("adds up to the sale price for %s", (_name, f) => {
    expect(scheduleTotal(buildSchedule(planFor(f)))).toBe(new Decimal(f.final_price).toFixed(2));
  });
});

describe("schedule edge cases", () => {
  const base: SchedulePlan = {
    finalPrice: "10000000",
    bookingDate: "2026-01-31",
    planKind: "installment",
    downPaymentPct: "30",
    installmentPct: "70",
    possessionPct: "0",
    tenureMonths: 24,
    frequency: "quarterly",
  };

  it("puts the rounding difference on the last installment, never loses a paisa", () => {
    // 70% of 10,000,001 = 7,000,000.70 over 8 is not a round number
    const lines = buildSchedule({ ...base, finalPrice: "10000001" });
    expect(scheduleTotal(lines)).toBe("10000001.00");
    const installments = lines.filter((l) => l.type === "installment");
    const first = installments[0].amount;
    expect(installments.slice(0, -1).every((l) => l.amount === first)).toBe(true);
    expect(Number(installments.at(-1)!.amount)).not.toBe(Number(first));
  });

  it("rolls month ends forward the way Postgres does", () => {
    const lines = buildSchedule(base).filter((l) => l.type === "installment");
    expect(lines[0].dueDate).toBe("2026-04-30"); // 31 Jan + 3 months
    expect(lines[1].dueDate).toBe("2026-07-30");
  });

  it("leaves the possession installment undated", () => {
    const lines = buildSchedule({ ...base, downPaymentPct: "40", installmentPct: "50", possessionPct: "10" });
    const possession = lines.find((l) => l.type === "possession");
    expect(possession?.dueDate).toBeNull();
    expect(possession?.amount).toBe("1000000.00");
  });

  it("splits the down payment only when the project sets a balance period", () => {
    const withSplit = buildSchedule({ ...base, bookingAmount: "500000", downPaymentBalanceDays: 30 });
    expect(withSplit.filter((l) => l.type === "down_payment")).toHaveLength(2);
    expect(withSplit[0].amount).toBe("500000.00");
    expect(withSplit[1].amount).toBe("2500000.00");
    expect(withSplit[1].dueDate).toBe("2026-03-02"); // 31 Jan + 30 days

    const noSplit = buildSchedule({ ...base, bookingAmount: "500000", downPaymentBalanceDays: null });
    expect(noSplit.filter((l) => l.type === "down_payment")).toHaveLength(1);
    expect(noSplit[0].amount).toBe("3000000.00");
  });

  it("makes a full-cash plan one line", () => {
    const lines = buildSchedule({ ...base, planKind: "full_cash", downPaymentPct: "100", installmentPct: "0" });
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toBe("Full Payment");
    expect(lines[0].amount).toBe("10000000.00");
  });

  it("returns nothing for a zero price", () => {
    expect(buildSchedule({ ...base, finalPrice: "0" })).toEqual([]);
  });
});
