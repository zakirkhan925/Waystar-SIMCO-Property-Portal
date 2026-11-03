import { z } from "zod";

const money = z
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

const reason = z.string().trim().min(3, "Give a short reason").max(500);

export const possessionSchema = z.object({
  sale_id: z.string().uuid(),
  handover_date: isoDate,
  dues_cleared_date: optionalIsoDate,
  notes: z.string().trim().max(1000),
});
export type PossessionValues = z.input<typeof possessionSchema>;
export type PossessionParsed = z.output<typeof possessionSchema>;

export const transferSchema = z
  .object({
    sale_id: z.string().uuid(),
    transfer_date: isoDate,
    transfer_fee: money,
    reason,
    notes: z.string().trim().max(1000),
    buyers: z
      .array(
        z.object({
          client_id: z.string().uuid("Choose a client"),
          share_pct: pct,
          is_primary: z.boolean(),
        }),
      )
      .min(1, "Add at least one new owner"),
  })
  .superRefine((v, ctx) => {
    const shares = v.buyers.reduce((n, b) => n + Number(b.share_pct || 0), 0);
    if (Math.abs(shares - 100) > 0.001) {
      ctx.addIssue({ code: "custom", path: ["buyers"], message: `Shares must add up to 100% (currently ${shares}%)` });
    }
    if (v.buyers.filter((b) => b.is_primary).length !== 1) {
      ctx.addIssue({ code: "custom", path: ["buyers"], message: "Mark exactly one buyer as the primary owner" });
    }
    if (new Set(v.buyers.map((b) => b.client_id)).size !== v.buyers.length) {
      ctx.addIssue({ code: "custom", path: ["buyers"], message: "The same client is listed twice" });
    }
  });
export type TransferValues = z.input<typeof transferSchema>;
export type TransferParsed = z.output<typeof transferSchema>;

export const cancellationSchema = z.object({
  sale_id: z.string().uuid(),
  cancelled_on: isoDate,
  deduction_pct: pct,
  reason,
});
export type CancellationValues = z.input<typeof cancellationSchema>;
export type CancellationParsed = z.output<typeof cancellationSchema>;

export const refundSchema = z.object({
  cancellation_id: z.string().uuid(),
  paid_on: isoDate,
  reference: z.string().trim().max(120),
  reason,
});
export type RefundValues = z.input<typeof refundSchema>;
export type RefundParsed = z.output<typeof refundSchema>;

export const REFUND_STATUS_LABELS = {
  pending_resale: "Awaiting re-sale",
  payable: "Payable",
  paid: "Paid",
  waived: "Waived",
} as const;
