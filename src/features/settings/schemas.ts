import { z } from "zod";

const pct = z
  .string()
  .trim()
  .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100, "Enter 0–100");

export const companySchema = z.object({
  company_name: z.string().trim().min(2).max(120),
  partner_name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(40),
  email: z.string().trim().refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email"),
  website: z.string().trim().max(120),
  default_sale_commission_pct: pct,
  default_lease_commission_pct: pct,
  default_rent_increment_pct: pct,
  discount_approval_threshold_pct: pct,
});

export type CompanyValues = z.input<typeof companySchema>;
export type CompanyParsed = z.output<typeof companySchema>;
