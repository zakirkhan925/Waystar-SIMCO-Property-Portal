import type { Metadata } from "next";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { listLeases, listRentalTotals } from "@/features/rentals/queries";
import { RentalsFilters } from "@/features/rentals/rentals-filters";
import { RentalsTable } from "@/features/rentals/rentals-table";
import { listProjectsBrief } from "@/features/users/queries";
import { requireRole } from "@/lib/auth/session";
import { formatPKRShort } from "@/lib/money";
import { Constants } from "@/types/database";

export const metadata: Metadata = { title: "Rentals" };

const paramsSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  project: z.uuid().optional().catch(undefined),
  status: z.enum(Constants.public.Enums.lease_status).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  size: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n)).catch(25),
});

export default async function RentalsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole("super_admin", "manager", "accounts", "viewer", "sales_agent");
  const filters = paramsSchema.parse(await searchParams);
  const [projects, leases] = await Promise.all([listProjectsBrief(), listLeases(filters)]);
  const totals = await listRentalTotals(leases);
  const page = Math.min(filters.page, Math.max(1, Math.ceil(leases.length / filters.size)));
  const start = (page - 1) * filters.size;

  return (
    <>
      <PageHeader title="Rentals" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active leases" value={totals.active} />
        <StatCard label="Rent due this month" value={formatPKRShort(totals.due)} />
        <StatCard label="Collected this month" value={formatPKRShort(totals.collected)} />
        <StatCard label="Overdue" value={formatPKRShort(totals.overdue)} />
      </div>
      <div className="space-y-4">
        <RentalsFilters projects={projects} initial={{ q: filters.q, projectId: filters.project, status: filters.status }} />
        <RentalsTable rows={leases.slice(start, start + filters.size)} total={leases.length} page={page} pageSize={filters.size} />
      </div>
    </>
  );
}
