import { z } from "zod";

const decimal = (msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d{1,8}(\.\d{1,2})?$/.test(v), msg);

export const projectFormSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the project name").max(80),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => /^[A-Z0-9]{2,6}$/.test(v), "2–6 letters/numbers, e.g. SV"),
    type: z.enum(["plot_society", "high_rise"]),
    status: z.enum(["off_plan", "under_construction", "completed"]),
    location: z.string().trim().max(120),
    description: z.string().trim().max(1000),
    sqft_per_marla: decimal("Enter sq ft per marla, e.g. 225"),
    marla_per_kanal: decimal("Enter marla per kanal, e.g. 20"),
    late_fee_method: z.enum(["none", "flat_per_installment", "pct_of_overdue_per_month", "pct_per_day"]),
    late_fee_rate: decimal("Enter a number"),
    late_fee_grace_days: z
      .string()
      .trim()
      .refine((v) => /^\d{1,3}$/.test(v), "Whole number of days"),
    late_fee_cap_pct: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100), "0–100"),
    sort_order: z
      .string()
      .trim()
      .refine((v) => /^\d{1,4}$/.test(v), "Whole number"),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.late_fee_method !== "none" && Number(v.late_fee_rate) <= 0) {
      ctx.addIssue({ code: "custom", path: ["late_fee_rate"], message: "Enter the penalty rate" });
    }
  });

export type ProjectFormValues = z.input<typeof projectFormSchema>;
export type ProjectFormParsed = z.output<typeof projectFormSchema>;

export const blockSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(40),
  kind: z.enum(["block", "tower", "phase", "sector"]),
});

export const floorsBulkSchema = z
  .object({
    basements: z.coerce.number().int().min(0).max(5),
    ground: z.boolean(),
    mezzanine: z.boolean(),
    from: z.coerce.number().int().min(1).max(150),
    to: z.coerce.number().int().min(0).max(150),
  })
  .refine((v) => v.to === 0 || v.to >= v.from, { path: ["to"], message: "Must be ≥ from" });

export const LATE_FEE_LABELS = {
  none: "No late penalty",
  flat_per_installment: "Flat amount per overdue installment (Rs)",
  pct_of_overdue_per_month: "% of overdue amount per month",
  pct_per_day: "% of overdue amount per day",
} as const;
