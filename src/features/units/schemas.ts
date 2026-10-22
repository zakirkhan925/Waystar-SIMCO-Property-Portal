import { z } from "zod";

const money = z
  .string()
  .trim()
  .transform((v) => v.replace(/[,\s]/g, "").replace(/^rs\.?/i, ""))
  .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), "Enter an amount in rupees, e.g. 12500000");

const optionalMoney = z
  .string()
  .trim()
  .transform((v) => v.replace(/[,\s]/g, ""))
  .refine((v) => v === "" || /^\d{1,12}(\.\d{1,2})?$/.test(v), "Enter an amount in rupees");

const optionalInt = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,2}$/.test(v), "Enter a whole number");

export const unitFormSchema = z
  .object({
    block_id: z.string().uuid("Select a block / tower"),
    floor_id: z.string(),
    street: z.string().trim().max(40),
    unit_no: z.string().trim().min(1, "Enter the unit / plot number").max(20),
    category: z.enum(["plot", "apartment", "shop", "office", "penthouse", "other"]),
    use: z.enum(["residential", "commercial"]),
    size_value: z
      .string()
      .trim()
      .refine((v) => /^\d{1,7}(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Enter the size, e.g. 5 or 1150"),
    size_unit: z.enum(["marla", "kanal", "sqft"]),
    bedrooms: optionalInt,
    bathrooms: optionalInt,
    is_corner: z.boolean(),
    is_park_facing: z.boolean(),
    is_main_boulevard: z.boolean(),
    base_price: money,
    price_per_sqft: optionalMoney,
    status: z.enum(["available", "on_hold", "blocked"]),
    notes: z.string().trim().max(1000),
    reason: z.string().trim().max(500),
  })
  .superRefine((v, ctx) => {
    if (v.category !== "plot" && !v.floor_id) {
      ctx.addIssue({ code: "custom", path: ["floor_id"], message: "Select the floor" });
    }
  });

export type UnitFormValues = z.input<typeof unitFormSchema>;
export type UnitFormParsed = z.output<typeof unitFormSchema>;

export const unitStatusChangeSchema = z.object({
  status: z.enum(["available", "on_hold", "blocked"]),
  reason: z.string().trim().min(3, "Give a short reason").max(500),
});
