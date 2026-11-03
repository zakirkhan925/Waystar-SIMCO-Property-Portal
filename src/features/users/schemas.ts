import { z } from "zod";

export const STAFF_ROLES = ["super_admin", "manager", "sales_agent", "accounts", "viewer"] as const;

/** What an admin may issue. They must change it at first sign-in, so this is a floor, not a policy. */
export const temporaryPassword = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Too long")
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/\d/, "Include a number");

export const userFormSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the name").max(120),
  // Login name. No email is needed: the account is created as <username>@waystar.internal.
  username: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => /^[A-Za-z0-9._-]{3,32}$/.test(v), "3–32 letters, digits, dot, underscore or hyphen"),
  // Contact only, never used to sign in.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email")
    .optional()
    .default(""),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9 -]{7,20}$/.test(v), "Enter a valid phone number"),
  role: z.enum(STAFF_ROLES),
  is_active: z.boolean(),
  project_ids: z.array(z.string().uuid()),
});

/** Creating an account also sets the first password. Editing one does not. */
export const createUserSchema = userFormSchema.extend({ password: temporaryPassword });

export const newPasswordSchema = z.object({
  user_id: z.string().uuid(),
  password: temporaryPassword,
});

export type CreateUserValues = z.input<typeof createUserSchema>;
export type CreateUserParsed = z.output<typeof createUserSchema>;
export type UserFormValues = z.input<typeof userFormSchema>;
export type UserFormParsed = z.output<typeof userFormSchema>;

export const ROLE_DESCRIPTIONS: Record<(typeof STAFF_ROLES)[number], string> = {
  super_admin: "Everything, including users, settings and deletions",
  manager: "All projects; approves discounts, cancellations, transfers",
  sales_agent: "Creates bookings and clients; sees own sales only",
  accounts: "Records payments, receipts, refunds, cheque clearing",
  viewer: "Read-only dashboards and reports (SIMCO management)",
};
