import { z } from "zod";
import { normalizeCnic } from "@/lib/cnic";

const phone = z
  .string()
  .trim()
  .refine((v) => /^\+?[0-9 -]{7,20}$/.test(v), "Enter a phone number, e.g. +92 300 1234567");
const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\+?[0-9 -]{7,20}$/.test(v), "Enter a valid phone number");
const optionalCnic = z
  .string()
  .trim()
  .transform((v) => (v === "" ? "" : (normalizeCnic(v) ?? v)))
  .refine((v) => v === "" || /^\d{5}-\d{7}-\d$/.test(v), "CNIC must be 13 digits: 12345-1234567-1");

export const clientFormSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter the full name").max(120),
    relation_type: z.enum(["s/o", "d/o", "w/o", ""]),
    guardian_name: z.string().trim().max(120),
    cnic: optionalCnic,
    passport_no: z.string().trim().toUpperCase().max(20),
    nationality: z.string().trim().min(2).max(60),
    is_overseas: z.boolean(),
    phone,
    whatsapp: optionalPhone,
    email: z.string().trim().refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email"),
    address: z.string().trim().max(300),
    city: z.string().trim().max(60),
    country: z.string().trim().min(2).max(60),
    nok_name: z.string().trim().max(120),
    nok_cnic: optionalCnic,
    nok_relation: z.string().trim().max(40),
    nok_phone: optionalPhone,
    notes: z.string().trim().max(1000),
  })
  .superRefine((v, ctx) => {
    if (!v.cnic && !v.passport_no) {
      ctx.addIssue({ code: "custom", path: ["cnic"], message: "Enter a CNIC (or a passport no. for foreign nationals)" });
    }
    if (v.is_overseas && !v.cnic && !v.passport_no) {
      ctx.addIssue({ code: "custom", path: ["passport_no"], message: "Overseas clients need a CNIC/NICOP or passport no." });
    }
  });

export type ClientFormValues = z.input<typeof clientFormSchema>;
export type ClientFormParsed = z.output<typeof clientFormSchema>;

export const CLIENT_DOC_KINDS = ["photo", "cnic_front", "cnic_back"] as const;
export type ClientDocKind = (typeof CLIENT_DOC_KINDS)[number];

export const clientListSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  size: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n)).catch(25),
  sort: z.enum(["full_name", "created_at", "city"]).catch("full_name"),
  dir: z.enum(["asc", "desc"]).catch("asc"),
});
export type ClientListParams = z.infer<typeof clientListSchema>;
