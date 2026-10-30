import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, FileText } from "lucide-react";
import { ActivityList } from "@/components/activity-list";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SaleStatusBadge } from "@/features/sales/badges";
import { PaymentsList } from "@/features/sales/payments-list";
import { getSale } from "@/features/sales/queries";
import { RecordPaymentDialog } from "@/features/sales/record-payment-dialog";
import { ScheduleTable } from "@/features/sales/schedule-table";
import { getActivity } from "@/features/units/queries";
import { formatSize } from "@/features/units/format";
import { can, getCurrentUser, hasRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";

type Props = { params: Promise<{ saleId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await getSale((await params).saleId);
  return { title: detail ? `Sale ${detail.sale.booking_form_no}` : "Sale" };
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

export default async function SalePage({ params }: Props) {
  const { saleId } = await params;
  const [user, detail] = await Promise.all([getCurrentUser(), getSale(saleId)]);
  if (!detail) notFound();

  const { sale, ledger, installments, payments, agentName } = detail;
  const unit = sale.units;
  const project = sale.projects;
  const buyers = (sale.sale_buyers ?? []).filter((b) => b.clients);
  const canHandleMoney = hasRole(user, "super_admin", "manager", "accounts");
  const activity = can(user).viewActivity ? await getActivity("sales", saleId) : [];
  const nextDue = installments.find((i) => ["pending", "partially_paid", "overdue"].includes(i.status));
  const nextDueAmount = nextDue
    ? (Number(nextDue.amount_due) + Number(nextDue.late_fee) - Number(nextDue.amount_paid) - Number(nextDue.waived_amount)).toFixed(2)
    : null;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Sales", href: "/sales" },
          { label: project?.name ?? "Project", href: `/projects/${sale.project_id}` },
          { label: sale.booking_form_no },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {unit?.unit_no ? `Unit ${unit.unit_no}` : "Sale"} <SaleStatusBadge status={sale.status} />
            {sale.cancellation_due && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" /> Cancellation due
              </Badge>
            )}
          </span>
        }
        description={
          <>
            {sale.booking_form_no} · booked {formatDate(sale.booking_date)}
            {agentName ? ` · ${agentName}` : ""}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/pdf/sale/${saleId}/booking_form`} target="_blank" rel="noopener noreferrer">
                <FileText /> Documents
              </a>
            </Button>
            {unit && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/units/${unit.id}`}>View unit</Link>
              </Button>
            )}
            {canHandleMoney && sale.status !== "cancelled" && (
              <RecordPaymentDialog
                saleId={saleId}
                suggestedAmount={nextDueAmount}
                buyers={buyers.map((b) => ({ id: b.clients!.id, full_name: b.clients!.full_name }))}
              />
            )}
          </>
        }
      />

      {sale.cancellation_due && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">This sale has reached the project&apos;s limit for missed installments.</p>
            <p className="text-muted-foreground">
              Nothing has been cancelled. A Manager decides whether to cancel it and what deduction applies.
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Sale price" value={formatPKR(sale.final_price)} hint={Number(sale.discount) > 0 ? `after ${formatPKR(sale.discount)} discount` : undefined} />
        <StatCard label="Received" value={formatPKR(ledger?.total_paid ?? 0)} hint={`${Number(ledger?.pct_paid ?? 0)}% of price`} />
        <StatCard label="Awaiting clearance" value={formatPKR(ledger?.total_pending ?? 0)} />
        <StatCard label="Balance" value={formatPKR(ledger?.balance ?? 0)} />
        <StatCard
          label="Overdue"
          value={formatPKR(ledger?.overdue_amount ?? 0)}
          hint={ledger?.max_days_overdue ? `up to ${ledger.max_days_overdue} days` : undefined}
        />
        <StatCard
          label="Next due"
          value={ledger?.next_due_date ? formatDate(ledger.next_due_date) : "—"}
          hint={nextDueAmount ? formatPKR(nextDueAmount) : undefined}
        />
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="payments">Receipts ({payments.length})</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          {can(user).viewActivity && <TabsTrigger value="activity">Activity</TabsTrigger>}
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <ScheduleTable installments={installments} />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <PaymentsList payments={payments} saleId={saleId} canHandleMoney={canHandleMoney} />
        </TabsContent>

        <TabsContent value="details" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Buyers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {buyers.map((b) => (
                <div key={b.clients!.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
                  <div>
                    <Link href={`/clients/${b.clients!.id}`} className="font-medium hover:underline">
                      {b.clients!.full_name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {b.clients!.cnic ?? b.clients!.passport_no} · {b.clients!.phone}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.is_primary && <Badge variant="secondary">Primary</Badge>}
                    <span className="text-sm tabular-nums">{Number(b.share_pct)}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4">
                <Item label="Unit" value={unit ? `${unit.unit_no} · ${[unit.blocks?.name, unit.street, unit.floors?.label].filter(Boolean).join(" · ")}` : null} />
                <Item label="Size" value={unit ? formatSize(unit.size_value, unit.size_unit, unit.area_sqft, unit) : null} />
                <Item label="List price" value={formatPKR(sale.list_price)} />
                <Item label="Discount" value={Number(sale.discount) > 0 ? formatPKR(sale.discount) : "None"} />
                <Item label="Plan" value={sale.payment_plans?.name ?? (sale.plan_kind === "full_cash" ? "Full payment" : "Installments")} />
                <Item
                  label="Split"
                  value={
                    sale.plan_kind === "full_cash"
                      ? "100% on booking"
                      : `${Number(sale.down_payment_pct)}% / ${Number(sale.installment_pct)}% / ${Number(sale.possession_pct)}%`
                  }
                />
                {sale.plan_kind === "installment" && (
                  <Item label="Tenure" value={`${sale.tenure_months} months, ${String(sale.frequency).replace("_", "-")}`} />
                )}
                <Item label="Booking amount" value={sale.booking_amount ? formatPKR(sale.booking_amount) : null} />
                <Item label="Commission" value={`${Number(sale.commission_pct)}% — earned as payments clear`} />
                <Item label="Booking form" value={<span className="font-mono text-xs">{sale.booking_form_no}</span>} />
              </dl>
              {sale.notes && <p className="mt-4 rounded-md bg-muted p-3 text-sm">{sale.notes}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {can(user).viewActivity && (
          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <ActivityList rows={activity} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
