import { z } from "zod";

export const STAFF_ROLES = ["super_admin", "manager", "sales_agent", "accounts", "viewer"] as const;

export const userFormSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the name").max(120),
  email: z.email("Enter a valid email").transform((v) => v.toLowerCase()),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9 -]{7,20}$/.test(v), "Enter a valid phone number"),
  role: z.enum(STAFF_ROLES),
  is_active: z.boolean(),
  project_ids: z.array(z.string().uuid()),
});

export type UserFormValues = z.input<typeof userFormSchema>;
export type UserFormParsed = z.output<typeof userFormSchema>;

export const ROLE_DESCRIPTIONS: Record<(typeof STAFF_ROLES)[number], string> = {
  super_admin: "Everything, including users, settings and deletions",
  manager: "All projects; approves discounts, cancellations, transfers",
  sales_agent: "Creates bookings and clients; sees own sales only",
  accounts: "Records payments, receipts, refunds, cheque clearing",
  viewer: "Read-only dashboards and reports (SIMCO management)",
};
