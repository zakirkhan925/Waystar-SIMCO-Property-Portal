import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { PAYMENT_STATUS_LABELS, PAYMENTS_ROLES, parsePaymentFilters, paymentPagination } from "@/features/payments/filters";
import { PaymentsFilters } from "@/features/payments/payments-filters";
import { PaymentsTable } from "@/features/payments/payments-table";
import { listPaymentsPage, paymentTotals } from "@/features/payments/queries";
import { listProjectsBrief } from "@/features/users/queries";
import { requireRole } from "@/lib/auth/session";
import { formatPKR } from "@/lib/money";

export const metadata: Metadata = { title: "Payments" };

const CARDS = { ...PAYMENT_STATUS_LABELS, cleared: "Total received (cleared)" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole(...PAYMENTS_ROLES);
  const params = await searchParams;
  const filters = parsePaymentFilters(params);
  const pagination = paymentPagination.parse(params);
  const [projects, { rows, total, page }, totals] = await Promise.all([
    listProjectsBrief(),
    listPaymentsPage({ ...filters, ...pagination }),
    paymentTotals(filters),
  ]);
  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) exportParams.set(key, value);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Review payments across your projects and reconcile receipts with the bank."
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/export/payments?${exportParams}`}><Download /> Export CSV</a>
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(totals) as (keyof typeof totals)[]).map((status) => (
          <StatCard
            key={status}
            label={CARDS[status]}
            value={formatPKR(totals[status].amount)}
            hint={`${totals[status].count.toLocaleString("en-PK")} payments`}
          />
        ))}
      </div>
      <div className="space-y-4">
        <PaymentsFilters projects={projects} initial={filters} />
        <PaymentsTable rows={rows} total={total} page={page} pageSize={pagination.size} />
      </div>
    </>
  );
}
