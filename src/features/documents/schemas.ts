import { z } from "zod";

const text = (max = 200) => z.string().trim().max(max);
const days = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,4}$/.test(v), "Whole number of days");

export const docSettingsSchema = z.object({
  display_name: text(80),
  full_address: text(200),
  execution_city: text(60),
  seller_legal_name: z.string().trim().min(2, "Required").max(120),
  seller_legal_status: text(200),
  seller_ntn: text(40),
  seller_office_address: text(200),
  seller_account_title: text(120),
  signatory_name: text(120),
  signatory_cnic: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{5}-\d{7}-\d$/.test(v), "CNIC: 12345-1234567-1"),
  managing_director_name: text(120),
  approval_noc_ref: text(120),
  possession_timeline: text(200),
  delay_compensation_basis: text(300),
  refund_days_after_resale: days,
  discrepancy_report_days: days,
  allotment_countersign_days: days,
  ndc_validity_days: z
    .string()
    .trim()
    .refine((v) => /^\d{1,3}$/.test(v) && Number(v) >= 1, "Days, at least 1"),
  dispute_window_days: z
    .string()
    .trim()
    .refine((v) => /^\d{1,3}$/.test(v) && Number(v) >= 1, "Days, at least 1"),
  marketed_by: z.string().trim().min(2).max(120),
  letterhead_top_mm: z
    .string()
    .trim()
    .refine((v) => /^\d{1,3}(\.\d)?$/.test(v) && Number(v) <= 200, "mm, e.g. 28.5"),
  letterhead_bottom_mm: z
    .string()
    .trim()
    .refine((v) => /^\d{1,3}(\.\d)?$/.test(v) && Number(v) <= 120, "mm, e.g. 28.5"),
  letterhead_left_mm: z
    .string()
    .trim()
    .refine((v) => /^\d{1,3}(\.\d)?$/.test(v) && Number(v) <= 60, "mm, e.g. 28.5"),
  letterhead_right_mm: z
    .string()
    .trim()
    .refine((v) => /^\d{1,3}(\.\d)?$/.test(v) && Number(v) <= 60, "mm, e.g. 28.5"),
  letterhead_head_top_mm: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{1,3}(\.\d)?$/.test(v) && Number(v) <= 200), "mm, or blank"),
  letterhead_head_left_mm: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{1,3}(\.\d)?$/.test(v) && Number(v) <= 200), "mm, or blank"),
}).superRefine((v, ctx) => {
  if (v.letterhead_head_top_mm !== "" && Number(v.letterhead_head_top_mm) >= Number(v.letterhead_top_mm)) {
    ctx.addIssue({ code: "custom", path: ["letterhead_head_top_mm"], message: "Must be above where the body starts" });
  }
});
export type DocSettingsValues = z.input<typeof docSettingsSchema>;
export type DocSettingsParsed = z.output<typeof docSettingsSchema>;

const clauseItem = z.union([
  z.string().trim().min(1, "Empty clause"),
  z.object({ title: z.string().trim().min(1, "Clause title required"), text: z.string().trim().min(1, "Clause text required") }),
]);

export const templateSchema = z.object({
  title: z.string().trim().min(2).max(80),
  ref_prefix: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => /^[A-Z]{2,5}$/.test(v), "2–5 letters"),
  sections: z
    .array(
      z.object({
        key: z.string().trim().regex(/^[a-z_]{2,30}$/),
        heading: z.string().trim().max(80),
        style: z.enum(["bullets", "numbered", "paragraphs", "clauses"]),
        items: z.array(clauseItem).min(1, "A section needs at least one item"),
      }),
    )
    .min(1),
  reason: z.string().trim().min(3, "Say why the wording changed").max(300),
});
export type TemplateInput = z.input<typeof templateSchema>;

/** Settings fields that templates reference as {{placeholders}}, with labels for the editor. */
export const PLACEHOLDER_HELP: Record<string, string> = {
  plot_no: "Plot number",
  project_name: "Project display name",
  project_address: "Project full address",
  booking_date: "Booking date",
  agreement_date: "Agreement date",
  allotment_ref: "Allotment letter ref.",
  allotment_date: "Allotment date",
  total_price: "Total sale price (PKR)",
  total_price_words: "Total price in words",
  purchaser_name: "Buyer name",
  purchaser_relation: "S/O, D/O, W/O",
  purchaser_guardian: "Father / husband name",
  purchaser_cnic: "Buyer CNIC",
  purchaser_address: "Buyer address",
  dues_cleared_date: "Date dues were cleared",
  ndc_purpose: "Purpose stated on the NDC",
  marketed_by: "Setting: marketed by",
  execution_city: "Setting: city of signing",
  seller_legal_name: "Setting: seller legal name",
  seller_legal_status: "Setting: legal status / registration / NTN",
  seller_office_address: "Setting: seller office",
  seller_account_title: "Setting: payee account title",
  signatory_name: "Setting: authorized signatory",
  signatory_cnic: "Setting: signatory CNIC",
  approval_noc_ref: "Setting: approval / NOC ref.",
  possession_timeline: "Setting: possession date / timeline",
  delay_compensation_basis: "Setting: delay compensation basis",
  refund_days_after_resale: "Setting: refund days after re-sale",
  discrepancy_report_days: "Setting: days to report discrepancies",
  allotment_countersign_days: "Setting: days to countersign allotment",
};
