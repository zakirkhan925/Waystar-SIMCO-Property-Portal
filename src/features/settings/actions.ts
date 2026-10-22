"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { companySchema } from "./schemas";

export async function updateCompanySettings(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin")) return { ok: false, error: "Only a Super Admin can change company settings." };
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_settings")
    .update({
      company_name: v.company_name,
      partner_name: v.partner_name,
      address: v.address || null,
      phone: v.phone || null,
      email: v.email || null,
      website: v.website || null,
      default_sale_commission_pct: v.default_sale_commission_pct as unknown as number,
      default_lease_commission_pct: v.default_lease_commission_pct as unknown as number,
      default_rent_increment_pct: v.default_rent_increment_pct as unknown as number,
      discount_approval_threshold_pct: v.discount_approval_threshold_pct as unknown as number,
    })
    .eq("id", true);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/settings/company");
  return { ok: true, message: "Settings saved." };
}
