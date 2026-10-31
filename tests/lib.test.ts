import { describe, expect, it } from "vitest";
import { formatPKR, formatPKRShort, parseMoney } from "@/lib/money";
import { maskCnic, normalizeCnic } from "@/lib/cnic";
import { formatDate } from "@/lib/dates";
import { toCsv } from "@/lib/csv";
import { clientFormSchema } from "@/features/clients/schemas";

describe("money", () => {
  it("formats PKR with thousands separators", () => {
    expect(formatPKR("1250000")).toBe("Rs 1,250,000");
    expect(formatPKR(0)).toBe("Rs 0");
    expect(formatPKR("1250000.5")).toBe("Rs 1,250,000.50");
    expect(formatPKR("-4500")).toBe("-Rs 4,500");
  });

  it("does not suffer float rounding", () => {
    // 0.1 + 0.2 style errors must not leak into displayed amounts
    expect(formatPKR("10000000.10")).toBe("Rs 10,000,000.10");
    expect(formatPKR("99999999999.99")).toBe("Rs 99,999,999,999.99");
  });

  it("shortens to Lac / Cr", () => {
    expect(formatPKRShort("12500000")).toBe("Rs 1.25 Cr");
    expect(formatPKRShort("4550000")).toBe("Rs 45.5 Lac");
    expect(formatPKRShort("85000")).toBe("Rs 85,000");
  });

  it("parses user input", () => {
    expect(parseMoney("Rs 1,250,000")).toBe("1250000.00");
    expect(parseMoney("1250000.5")).toBe("1250000.50");
    expect(parseMoney("12.345")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("CNIC", () => {
  it("normalizes 13 digits with or without dashes", () => {
    expect(normalizeCnic("3740512345671")).toBe("37405-1234567-1");
    expect(normalizeCnic("37405-1234567-1")).toBe("37405-1234567-1");
    expect(normalizeCnic("37405 1234567 1")).toBe("37405-1234567-1");
    expect(normalizeCnic("123")).toBeNull();
  });
  it("masks for printed documents", () => {
    expect(maskCnic("37405-1234567-1")).toBe("37405-*******-1");
  });
});

describe("dates", () => {
  it("formats calendar dates as DD-MMM-YYYY without timezone shift", () => {
    expect(formatDate("2026-10-21")).toBe("21-Oct-2026");
    expect(formatDate("2026-01-01")).toBe("01-Jan-2026");
  });
  it("shows instants in Pakistan time", () => {
    // 20:30 UTC on 31 Dec is already 1 Jan in Karachi (UTC+5)
    expect(formatDate("2026-12-31T20:30:00Z")).toBe("01-Jan-2027");
  });
});

describe("CSV", () => {
  it("quotes, escapes and blocks formula injection", () => {
    const csv = toCsv(["a", "b"], [["x,y", '=HYPERLINK("evil")'], [1250000, null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe(`"x,y","'=HYPERLINK(""evil"")"`);
    expect(lines[2]).toBe("1250000,");
  });
});

describe("client validation", () => {
  const base = {
    full_name: "Test Person", relation_type: "s/o" as const, guardian_name: "", cnic: "", passport_no: "",
    nationality: "Pakistani", is_overseas: false, phone: "+92 300 1234567", whatsapp: "", email: "", address: "",
    city: "", country: "Pakistan", nok_name: "", nok_cnic: "", nok_relation: "", nok_phone: "", notes: "",
  };
  it("requires CNIC or passport", () => {
    expect(clientFormSchema.safeParse(base).success).toBe(false);
    expect(clientFormSchema.safeParse({ ...base, passport_no: "ab1234567" }).success).toBe(true);
  });
  it("normalizes CNIC typed without dashes", () => {
    const r = clientFormSchema.safeParse({ ...base, cnic: "3740512345671" });
    expect(r.success && r.data.cnic).toBe("37405-1234567-1");
  });
  it("rejects malformed CNIC", () => {
    expect(clientFormSchema.safeParse({ ...base, cnic: "1234-1234567-1" }).success).toBe(false);
  });
});

describe("project policy validation", async () => {
  const { projectFormSchema } = await import("@/features/projects/schemas");
  const base = {
    name: "Simco Villas", code: "SV", type: "plot_society" as const, status: "under_construction" as const, location: "", description: "",
    sqft_per_marla: "225", marla_per_kanal: "20", late_fee_method: "pct_of_overdue_per_month" as const, late_fee_rate: "10",
    late_fee_grace_days: "0", late_fee_cap_pct: "", corner_premium_pct: "10", cancel_after_consecutive_missed: "2",
    cancellation_deduction_pct: "20", construction_min_paid_pct: "80", full_payment_possession_charge_pct: "5",
    down_payment_balance_days: "", sort_order: "1", is_active: true,
  };
  it("accepts SIMCO's Simco Villas policy values", () => {
    expect(projectFormSchema.safeParse(base).success).toBe(true);
  });
  it("rejects percentages over 100", () => {
    expect(projectFormSchema.safeParse({ ...base, cancellation_deduction_pct: "120" }).success).toBe(false);
  });
});

describe("recovery reminder", async () => {
  const { reminderText, whatsappLink } = await import("@/features/recoveries/reminder");
  const base = {
    clientName: "Saad Bin Zafar",
    unitNo: "303",
    projectName: "Simco Villas",
    label: "Installment 1 of 8 (Quarterly)",
    dueDate: "2025-09-16",
    outstanding: "1522500",
    principal: "761250",
    lateFee: "761250",
    daysOverdue: 408,
    companyName: "Waystar Royco Marketing",
  };

  it("spells the penalty out separately rather than burying it", () => {
    const text = reminderText(base);
    expect(text).toContain("Installment amount: Rs 761,250");
    expect(text).toContain("Late payment penalty: Rs 761,250");
    expect(text).toContain("Amount payable: Rs 1,522,500");
    expect(text).toContain("Days overdue: 408");
    expect(text).toContain("is overdue");
  });

  it("stays simple when nothing is overdue and no penalty applies", () => {
    const text = reminderText({ ...base, daysOverdue: 0, lateFee: 0, outstanding: "761250" });
    expect(text).toContain("upcoming installment");
    expect(text).not.toContain("Late payment penalty");
    expect(text).not.toContain("Days overdue");
  });

  it("builds a WhatsApp link in international form", () => {
    expect(whatsappLink("0300 5678901", "hi")).toBe("https://wa.me/923005678901?text=hi");
    expect(whatsappLink("+92 300 5678901", "hi")).toBe("https://wa.me/923005678901?text=hi");
  });
});
