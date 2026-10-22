import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CompanyForm } from "@/features/settings/company";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Company settings" };

export default async function CompanySettingsPage() {
  await requireRole("super_admin");
  const supabase = await createClient();
  const { data: s } = await supabase.from("company_settings").select("*").single();
  if (!s) throw new Error("Company settings row is missing");

  return (
    <>
      <PageHeader crumbs={[{ label: "Settings", href: "/settings" }, { label: "Company" }]} title="Company settings" />
      <CompanyForm
        initial={{
          company_name: s.company_name,
          partner_name: s.partner_name,
          address: s.address ?? "",
          phone: s.phone ?? "",
          email: s.email ?? "",
          website: s.website ?? "",
          default_sale_commission_pct: String(s.default_sale_commission_pct),
          default_lease_commission_pct: String(s.default_lease_commission_pct),
          default_rent_increment_pct: String(s.default_rent_increment_pct),
          discount_approval_threshold_pct: String(s.discount_approval_threshold_pct),
        }}
      />
    </>
  );
}
