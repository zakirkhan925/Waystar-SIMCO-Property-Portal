import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { LeaseWizard } from "@/features/rentals/lease-wizard";
import { getLeaseOptions } from "@/features/rentals/queries";
import { getOwnershipHistory } from "@/features/sales/queries";
import { getUnit } from "@/features/units/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata = { title: "Rent out this unit" };

export default async function NewLeasePage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  await requireRole("super_admin", "manager");
  const id = z.uuid().safeParse((await searchParams).unit);
  if (!id.success) notFound();
  const [unit, ownership, options] = await Promise.all([getUnit(id.data), getOwnershipHistory(id.data), getLeaseOptions()]);
  if (!unit || !["available", "on_hold", "sold"].includes(unit.status)) notFound();
  const landlords = unit.status === "sold"
    ? ownership.flatMap((owner) => owner.valid_to === null && owner.clients
        ? [{ value: owner.client_id, label: owner.clients.full_name }] : [])
    : [{ value: "", label: "SIMCO" }];

  return (
    <>
      <PageHeader title="Rent out this unit"
        crumbs={[{ label: "Rentals", href: "/rentals" }, { label: unit.unit_no, href: `/units/${unit.id}` }]}
        description={[unit.projects?.name, unit.unit_no].filter(Boolean).join(" · ")} />
      {landlords.length ? (
        <LeaseWizard unitId={unit.id} landlords={landlords}
          agents={options.agents.map((row) => ({ value: row.id, label: row.full_name }))}
          dealers={options.dealers.map((row) => ({ value: row.id, label: row.name }))}
          increment={String(options.defaults.default_rent_increment_pct)}
          commission={String(options.defaults.default_lease_commission_pct)} />
      ) : <p className="text-sm text-muted-foreground">This unit has no current owner to select as landlord.</p>}
    </>
  );
}
