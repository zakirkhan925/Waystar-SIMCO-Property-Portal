import type { ReactNode } from "react";
import Link from "next/link";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, todayPK } from "@/lib/dates";
import { formatPKR, toDecimal } from "@/lib/money";
import type { Enums } from "@/types/database";
import { LeaseAction } from "./lease-actions";
import { paymentModeLabels } from "./terms";
import type { getLeaseActivity, Lease } from "./queries";
import { landlordBalance, nextRentIncrease } from "./terms";

const eventLabels: Record<Enums<"lease_event_type">, string> = {
  created: "Lease created", expired: "Lease expired", terminated: "Lease terminated", renewed: "Lease renewed",
  rent_increased: "Rent increased", penalty_added: "Penalty added", penalty_waived: "Penalty waived",
};
const depositLabels = { received: "Received", adjusted: "Adjusted", refunded: "Refunded" };

function Records({ columns, rows, empty }: {
  columns: string[]; rows: { id: string; cells: ReactNode[] }[]; empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>{columns.map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? rows.map(({ id, cells }) => (
            <TableRow key={id}>{cells.map((cell, index) => <TableCell key={index}>{cell}</TableCell>)}</TableRow>
          )) : <TableRow><TableCell colSpan={columns.length} className="py-6 text-center text-muted-foreground">{empty}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

function ClientLink({ id, name }: { id: string; name: string | null | undefined }) {
  return name ? <Link className="hover:underline" href={`/clients/${id}`}>{name}</Link> : "—";
}

export function LeaseOverview({ lease }: { lease: Lease }) {
  const increase = lease.status === "active" && toDecimal(lease.increment_pct).gt(0)
    ? nextRentIncrease(lease.start_date, lease.end_date, todayPK()) : null;
  const terms = [
    ["Unit", <Link className="hover:underline" key="unit" href={`/units/${lease.unit_id}`}>{lease.units?.unit_no ?? "Unit"}</Link>],
    ["Landlord", lease.landlord_client_id ? <ClientLink key="landlord" id={lease.landlord_client_id} name={lease.landlord_name} /> : "SIMCO"],
    ["Tenant", <ClientLink key="tenant" id={lease.tenant_client_id} name={lease.tenant_name} />],
    ["Lease term", `${formatDate(lease.start_date)} to ${formatDate(lease.end_date)}`],
    ["Current rent", formatPKR(lease.current_rent)],
    ["Next increase", increase ? `${formatDate(increase)} (${lease.increment_pct}%)` : "—"],
    ["Rent due day", String(lease.rent_due_day)],
    ["Agreed deposit", formatPKR(lease.security_deposit)],
  ] as const;
  return (
    <Card className="mb-4">
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {terms.map(([label, value]) => <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value}</dd>
          </div>)}
        </dl>
        {lease.renewed_from_id && <Link className="text-sm underline" href={`/rentals/${lease.renewed_from_id}`}>Previous lease</Link>}
        {lease.notes && <p className="text-sm text-muted-foreground">{lease.notes}</p>}
      </CardContent>
    </Card>
  );
}

export function LeaseDetail({ lease, activity, manager, money }: {
  lease: Lease; activity: Awaited<ReturnType<typeof getLeaseActivity>>; manager: boolean; money: boolean;
}) {
  const { invoices, payments, deposits, payouts, events, ledger } = activity;

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Rent billed" value={formatPKR(ledger.rent_billed)} />
        <StatCard label="Rent collected" value={formatPKR(ledger.rent_collected)} hint={`${formatPKR(ledger.pending_clearance)} pending clearance`} />
        <StatCard label="Outstanding" value={formatPKR(ledger.outstanding)} />
        <StatCard label="Overdue" value={formatPKR(ledger.overdue)} />
      </div>
      <Tabs defaultValue="invoices">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="payouts">Owner payouts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          <Records columns={["Invoice", "Period", "Due", "Rent", "Penalty", "Waived", "Paid", "Balance", "Status", ...(manager ? ["Actions"] : [])]}
            empty="No rent invoices yet." rows={invoices.flatMap((invoice) => {
              const id = invoice.id;
              if (!id) return [];
              return [{ id, cells: [
                invoice.invoice_no, formatDate(invoice.period), formatDate(invoice.due_date), formatPKR(invoice.rent_amount),
                formatPKR(invoice.late_fee), formatPKR(invoice.waived_amount), formatPKR(invoice.amount_paid),
                formatPKR(invoice.outstanding), toDecimal(invoice.outstanding).isZero() ? "Paid" :
                  invoice.days_overdue ? `Overdue (${invoice.days_overdue} days)` : "Due",
                ...(manager ? [<div key="actions" className="flex gap-1.5">
                  <LeaseAction leaseId={lease.id} intent="penalty" title="Add penalty" target={id} description={invoice.invoice_no ?? undefined} />
                  {toDecimal(invoice.late_fee).gt(invoice.waived_amount ?? 0) &&
                    <LeaseAction leaseId={lease.id} intent="waive" title="Waive" target={id} description={invoice.invoice_no ?? undefined} />}
                </div>] : []),
              ] }];
            })} />
        </TabsContent>

        <TabsContent value="receipts" className="mt-4 space-y-3">
          {money && <LeaseAction leaseId={lease.id} intent="payment" title="Record rent payment" />}
          <Records columns={["Receipt", "Received", "Mode", "Instrument", "Amount", "Status", ...(money ? ["Actions"] : [])]}
            empty="No rent receipts yet." rows={payments.flatMap((payment) => {
              const id = payment.id;
              if (!id) return [];
              const reversed = payment.status === "reversed";
              const status = reversed ? "Reversed" : payment.instrument_status === "pending" ? "Pending clearance"
                : payment.instrument_status === "bounced" ? "Bounced" : "Cleared";
              return [{ id, cells: [
                payment.receipt_no, formatDate(payment.received_on), payment.mode ? paymentModeLabels[payment.mode] : "—",
                [payment.bank_name, payment.instrument_no, payment.instrument_date && formatDate(payment.instrument_date)].filter(Boolean).join(" · ") || "—",
                formatPKR(payment.amount), <Badge key="status" variant="outline" title={payment.reversal_reason ?? payment.bounced_reason ?? undefined}>{status}</Badge>,
                ...(money ? [<div key="actions" className="flex gap-1.5">
                  {!reversed && (payment.instrument_status === "pending" || payment.instrument_status === "bounced") &&
                    <LeaseAction leaseId={lease.id} intent="clear" title="Clear" target={id} />}
                  {!reversed && (payment.instrument_status === "pending" || payment.instrument_status === "cleared") &&
                    <LeaseAction leaseId={lease.id} intent="bounce" title="Bounce" target={id} />}
                  {!reversed && <LeaseAction leaseId={lease.id} intent="reverse" title="Reverse" target={id} />}
                </div>] : []),
              ] }];
            })} />
        </TabsContent>

        <TabsContent value="deposit" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Deposit held {formatPKR(ledger.deposit_held)}</p>
            {money && <LeaseAction leaseId={lease.id} intent="deposit" title="Record deposit entry" />}
          </div>
          <Records columns={["Date", "Type", "Amount", "Reference", "Reason"]} empty="No deposit entries yet."
            rows={deposits.map((row) => ({ id: row.id, cells: [
              formatDate(row.txn_date), depositLabels[row.type], formatPKR(row.amount), row.reference_no ?? "—", row.reason,
            ] }))} />
        </TabsContent>

        <TabsContent value="payouts" className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Rent collected" value={formatPKR(ledger.rent_collected)} />
            <StatCard label="Commission earned" value={formatPKR(ledger.commission_earned)} />
            <StatCard label="Paid out" value={formatPKR(ledger.paid_out)} />
            <StatCard label="Owed to landlord" value={formatPKR(landlordBalance(ledger.rent_collected, ledger.commission_earned, ledger.paid_out))} />
          </div>
          {money && toDecimal(ledger.owed_to_landlord).gt(0) &&
            <LeaseAction leaseId={lease.id} intent="payout" title="Record owner payout" />}
          <Records columns={["Paid on", "Amount", "Mode", "Reference", "Status", ...(money ? ["Actions"] : [])]} empty="No payouts yet."
            rows={payouts.map((row) => ({ id: row.id, cells: [
              formatDate(row.paid_on), formatPKR(row.amount), paymentModeLabels[row.mode], row.reference_no,
              row.status === "reversed" ? `Reversed · ${row.reversal_reason ?? ""}` : "Paid",
              ...(money ? [row.status === "valid" ?
                <LeaseAction key="reverse" leaseId={lease.id} intent="reversePayout" title="Reverse payout" target={row.id} /> : null] : []),
            ] }))} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Records columns={["Date", "Event", "Details"]} empty="No lease activity yet."
            rows={events.map((row) => ({ id: row.id, cells: [
              formatDate(row.event_date), eventLabels[row.type],
              [row.old_rent !== null && `${formatPKR(row.old_rent)} to ${formatPKR(row.new_rent)}`,
                row.amount !== null && formatPKR(row.amount), row.details].filter(Boolean).join(" · ") || "—",
            ] }))} />
        </TabsContent>
      </Tabs>
    </>
  );
}
