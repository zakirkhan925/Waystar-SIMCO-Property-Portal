import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { listRefunds, refundTotals } from "@/features/phase3/queries";
import { RefundsTable } from "@/features/phase3/refunds-table";
import { getCurrentUser, hasRole, requireRole } from "@/lib/auth/session";
import { formatPKR } from "@/lib/money";

export const metadata: Metadata = { title: "Refunds" };

export default async function RefundsPage() {
  await requireRole("super_admin", "manager", "accounts", "viewer");
  const [user, rows, totals] = await Promise.all([getCurrentUser(), listRefunds(), refundTotals()]);
  const canSettle = hasRole(user, "super_admin", "manager", "accounts");

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Refunds" }]}
        title="Refunds"
        description="Money owed back on cancelled bookings. A refund becomes payable once the plot is re-sold."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Payable now" value={formatPKR(totals.payable)} />
        <StatCard
          label="Past due"
          value={formatPKR(totals.overdue)}
          className={totals.overdue > 0 ? "border-destructive/40" : undefined}
        />
        <StatCard label="Awaiting re-sale" value={formatPKR(totals.awaitingResale)} hint="not payable yet" />
        <StatCard label="Refunded" value={formatPKR(totals.paid)} />
      </div>

      <RefundsTable rows={rows} canSettle={canSettle} />
    </>
  );
}
