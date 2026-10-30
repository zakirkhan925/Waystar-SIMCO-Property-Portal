import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookingWizard } from "@/features/sales/booking-wizard";
import { getUnitForBooking, listPaymentPlans } from "@/features/sales/queries";
import { formatSize } from "@/features/units/format";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  await requireRole("super_admin", "manager", "sales_agent");
  const { unit: unitId } = await searchParams;

  if (!unitId) {
    return (
      <>
        <PageHeader crumbs={[{ label: "Sales", href: "/sales" }, { label: "New booking" }]} title="New booking" />
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Start from the unit you want to book: open a project&apos;s inventory and choose an available unit.
            </p>
            <Button asChild>
              <Link href="/projects">Choose a unit</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  const supabase = await createClient();
  const [unit, { data: dealers }, { data: company }] = await Promise.all([
    getUnitForBooking(unitId),
    supabase.from("dealers").select("id, name").eq("is_active", true).is("deleted_at", null).order("name"),
    supabase.from("company_settings").select("default_sale_commission_pct").single(),
  ]);
  if (!unit) notFound();

  const project = unit.projects;
  const plans = await listPaymentPlans(unit.project_id);

  const blocked = ["booked", "sold", "rented", "blocked"].includes(unit.status);
  if (blocked) {
    return (
      <>
        <PageHeader
          crumbs={[{ label: "Sales", href: "/sales" }, { label: "New booking" }]}
          title={`Unit ${unit.unit_no} is not available`}
        />
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">This unit is {unit.status.replace("_", " ")} and cannot be booked.</p>
            <Button variant="outline" asChild>
              <Link href={`/projects/${unit.project_id}`}>Back to inventory</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Projects", href: "/projects" },
          { label: project?.name ?? "Project", href: `/projects/${unit.project_id}` },
          { label: `Book ${unit.unit_no}` },
        ]}
        title={`Book unit ${unit.unit_no}`}
      />
      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No payment plans are set up for this project yet. A Manager can add one in Settings.
          </CardContent>
        </Card>
      ) : (
        <BookingWizard
          unit={{
            id: unit.id,
            unit_no: unit.unit_no,
            base_price: unit.base_price,
            projectName: project?.name ?? "",
            projectId: unit.project_id,
            location: [unit.blocks?.name, unit.street, unit.floors?.label].filter(Boolean).join(" · "),
            sizeLabel: formatSize(unit.size_value, unit.size_unit, unit.area_sqft, unit),
            isCorner: unit.is_corner,
            cornerPremiumPct: Number(project?.corner_premium_pct ?? 0),
            downPaymentBalanceDays: project?.down_payment_balance_days ?? null,
          }}
          plans={plans}
          dealers={dealers ?? []}
          defaultCommissionPct={String(company?.default_sale_commission_pct ?? 5)}
        />
      )}
    </>
  );
}
