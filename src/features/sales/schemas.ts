import { z } from "zod";

const money = z
  .string()
  .trim()
  .transform((v) => v.replace(/[,\s]/g, "").replace(/^rs\.?/i, ""))
  .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), "Enter an amount in rupees, e.g. 12500000");

const optionalMoney = z
  .string()
  .trim()
  .transform((v) => v.replace(/[,\s]/g, "").replace(/^rs\.?/i, ""))
  .refine((v) => v === "" || /^\d{1,12}(\.\d{1,2})?$/.test(v), "Enter an amount in rupees");

const isoDate = z
  .string()
  .trim()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a date");

const optionalIsoDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a date");

const pct = z
  .string()
  .trim()
  .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100, "Enter 0–100");

/** Radix selects cannot carry an empty value, so "no dealer" needs a real one. */
export const NO_DEALER = "none";

export const buyerSchema = z.object({
  client_id: z.string().uuid("Choose a client"),
  share_pct: pct,
  is_primary: z.boolean(),
});

export const bookingSchema = z
  .object({
    unit_id: z.string().uuid(),
    booking_date: isoDate,
    buyers: z.array(buyerSchema).min(1, "Add at least one buyer"),
    list_price: money,
    discount: optionalMoney,
    plan_kind: z.enum(["full_cash", "installment"]),
    payment_plan_id: z.string(),
    down_payment_pct: pct,
    installment_pct: pct,
    possession_pct: pct,
    tenure_months: z.string().trim(),
    frequency: z.enum(["monthly", "quarterly", "bi_annual", "annual", ""]),
    booking_amount: optionalMoney,
    first_installment_date: optionalIsoDate,
    dealer_id: z.string(),
    commission_pct: pct,
    notes: z.string().trim().max(1000),
  })
  .superRefine((v, ctx) => {
    const shares = v.buyers.reduce((n, b) => n + Number(b.share_pct || 0), 0);
    if (Math.abs(shares - 100) > 0.001) {
      ctx.addIssue({ code: "custom", path: ["buyers"], message: `Buyer shares must add up to 100% (currently ${shares}%)` });
    }
    if (v.buyers.filter((b) => b.is_primary).length !== 1) {
      ctx.addIssue({ code: "custom", path: ["buyers"], message: "Mark exactly one buyer as the primary buyer" });
    }
    if (new Set(v.buyers.map((b) => b.client_id)).size !== v.buyers.length) {
      ctx.addIssue({ code: "custom", path: ["buyers"], message: "The same client is listed twice" });
    }
    if (Number(v.discount || 0) > Number(v.list_price || 0)) {
      ctx.addIssue({ code: "custom", path: ["discount"], message: "The discount is more than the price" });
    }
    const total = Number(v.down_payment_pct) + Number(v.installment_pct) + Number(v.possession_pct);
    if (Math.abs(total - 100) > 0.001) {
      ctx.addIssue({ code: "custom", path: ["down_payment_pct"], message: `The three percentages must add up to 100% (currently ${total}%)` });
    }
    if (v.plan_kind === "installment") {
      if (!/^\d{1,3}$/.test(v.tenure_months) || Number(v.tenure_months) < 1) {
        ctx.addIssue({ code: "custom", path: ["tenure_months"], message: "Enter the tenure in months" });
      }
      if (!v.frequency) {
        ctx.addIssue({ code: "custom", path: ["frequency"], message: "Choose how often installments fall due" });
      }
    }
    const final = Number(v.list_price || 0) - Number(v.discount || 0);
    if (v.booking_amount !== "" && Number(v.booking_amount) > final) {
      ctx.addIssue({ code: "custom", path: ["booking_amount"], message: "The booking amount is more than the price" });
    }
  });

export type BookingValues = z.input<typeof bookingSchema>;
export type BookingParsed = z.output<typeof bookingSchema>;

export const paymentSchema = z
  .object({
    sale_id: z.string().uuid(),
    received_on: isoDate,
    amount: money,
    mode: z.enum(["cash", "cheque", "pay_order", "bank_transfer", "online"]),
    bank_name: z.string().trim().max(80),
    instrument_no: z.string().trim().max(40),
    instrument_date: optionalIsoDate,
    already_cleared: z.boolean(),
    payer_client_id: z.string(),
    notes: z.string().trim().max(500),
  })
  .superRefine((v, ctx) => {
    if (v.mode !== "cash" && v.mode !== "online") {
      if (!v.instrument_no) {
        ctx.addIssue({ code: "custom", path: ["instrument_no"], message: "Enter the cheque / instrument number" });
      }
      if (!v.bank_name) {
        ctx.addIssue({ code: "custom", path: ["bank_name"], message: "Enter the bank" });
      }
    }
    if (Number(v.amount) <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter an amount above zero" });
    }
  });

export type PaymentValues = z.input<typeof paymentSchema>;
export type PaymentParsed = z.output<typeof paymentSchema>;

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, "Give a short reason").max(500),
});

export const PAYMENT_MODE_LABELS = {
  cash: "Cash",
  cheque: "Cheque",
  pay_order: "Pay order",
  bank_transfer: "Bank transfer",
  online: "Online",
} as const;

export const SALE_STATUS_LABELS = {
  booked: "Booked",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  transferred: "Transferred",
} as const;

export const INSTALLMENT_STATUS_LABELS = {
  pending: "Pending",
  partially_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  waived: "Waived",
} as const;
