import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeaseAction } from "@/features/rentals/lease-actions";
import { LeaseDetail, LeaseOverview } from "@/features/rentals/lease-detail";
import { getLease, getLeaseActivity } from "@/features/rentals/queries";
import { LEASE_STATUS_LABELS } from "@/features/rentals/terms";
import { hasRole, requireRole } from "@/lib/auth/session";
import { todayPK } from "@/lib/dates";

export const metadata = { title: "Lease" };

export default async function LeasePage({ params }: { params: Promise<{ leaseId: string }> }) {
  const user = await requireRole("super_admin", "manager", "accounts", "viewer", "sales_agent");
  const id = z.uuid().safeParse((await params).leaseId);
  if (!id.success) notFound();
  const lease = await getLease(id.data);
  if (!lease) notFound();

  const activity = await getLeaseActivity(lease.id);
  const manager = hasRole(user, "super_admin", "manager");
  const money = manager || hasRole(user, "accounts");
  const today = todayPK();
  const canTerminate = lease.status === "active" && lease.start_date <= today && lease.end_date >= today;
  const canRenew = (lease.status === "active" || lease.status === "expired") && lease.end_date < today;

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-2">
          {lease.agreement_no} <Badge variant="secondary">{LEASE_STATUS_LABELS[lease.status]}</Badge>
        </span>}
        crumbs={[{ label: "Rentals", href: "/rentals" }, { label: lease.agreement_no }]}
        description={lease.projects?.name}
        actions={<>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/pdf/lease/${lease.id}`} target="_blank" rel="noopener noreferrer">Lease summary</a>
          </Button>
          {manager && canRenew && <LeaseAction leaseId={lease.id} lease={lease} intent="renew" title="Renew" />}
          {manager && canTerminate && <LeaseAction leaseId={lease.id} intent="terminate" title="Terminate" />}
        </>}
      />
      <LeaseOverview lease={lease} />
      <LeaseDetail lease={lease} activity={activity} manager={manager} money={money} />
    </>
  );
}
