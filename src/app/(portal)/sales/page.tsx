import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { listSalesPage } from "@/features/sales/queries";
import { SalesFilters } from "@/features/sales/sales-filters";
import { SalesTable } from "@/features/sales/sales-table";
import { listProjectsBrief } from "@/features/users/queries";
import { can, getCurrentUser } from "@/lib/auth/session";
import { formatPKRShort } from "@/lib/money";

export const metadata: Metadata = { title: "Sales" };

const paramsSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  project: z.string().uuid().optional().catch(undefined),
  status: z.enum(["booked", "active", "completed", "cancelled", "transferred"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  size: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n)).catch(25),
  sort: z.enum(["booking_date", "final_price", "unit_no", "balance"]).catch("booking_date"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
});

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const p = paramsSchema.parse(sp);
  const query = { q: p.q, projectId: p.project, status: p.status, page: p.page, size: p.size, sort: p.sort, dir: p.dir };

  const [user, projects, { rows, total }] = await Promise.all([
    getCurrentUser(),
    listProjectsBrief(),
    listSalesPage(query),
  ]);

  const sum = (pick: (r: (typeof rows)[number]) => number | string | null) =>
    rows.reduce((n, r) => n + Number(pick(r) ?? 0), 0);
  const exportQs = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (v && !["page", "size"].includes(k) ? [[k, v]] : [])),
  );

  return (
    <>
      <PageHeader
        title="Sales"
        description="Bookings across every project you can see."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/export/sales?${exportQs}`}>
                <Download /> CSV
              </a>
            </Button>
            {can(user).createClients && (
              <Button size="sm" asChild>
                <Link href="/bookings/new">
                  <Plus /> New booking
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Bookings on this page" value={rows.length} hint={`of ${total.toLocaleString("en-PK")} matching`} />
        <StatCard label="Sale value" value={formatPKRShort(sum((r) => r.final_price))} />
        <StatCard label="Received" value={formatPKRShort(sum((r) => r.total_paid))} />
        <StatCard label="Overdue" value={formatPKRShort(sum((r) => r.overdue_amount))} />
      </div>

      <div className="space-y-4">
        <SalesFilters projects={projects} initial={{ q: p.q, projectId: p.project, status: p.status }} />
        <SalesTable rows={rows} total={total} page={p.page} pageSize={p.size} sort={p.sort} dir={p.dir} />
      </div>
    </>
  );
}
