import type { Metadata } from "next";
import Link from "next/link";
import Decimal from "decimal.js";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CollectionsChart } from "@/features/dashboard/collections-chart";
import { getSalesOverview } from "@/features/dashboard/queries";
import { StatusByProjectChart } from "@/features/dashboard/status-chart";
import { getInventorySummary } from "@/features/projects/queries";
import { SaleStatusBadge } from "@/features/sales/badges";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { formatPKR, formatPKRShort } from "@/lib/money";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [user, rows, overview] = await Promise.all([getCurrentUser(), getInventorySummary(), getSalesOverview()]);

  const sum = (k: "total_units" | "available" | "on_hold" | "booked" | "sold" | "rented" | "blocked") =>
    rows.reduce((n, r) => n + (r[k] ?? 0), 0);
  const unsoldValue = rows.reduce((d, r) => d.plus(r.unsold_inventory_value ?? 0), new Decimal(0));

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.fullName.split(" ")[0]}`}
        description="Inventory, sales and collections across the SIMCO projects you can see."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total units" value={sum("total_units").toLocaleString("en-PK")} hint={`${sum("available")} available`} />
        <StatCard label="Booked" value={sum("booked").toLocaleString("en-PK")} />
        <StatCard label="Sold" value={sum("sold").toLocaleString("en-PK")} />
        <StatCard label="Unsold inventory" value={formatPKRShort(unsoldValue.toString())} />
        <StatCard label="Sale value" value={formatPKRShort(overview.saleValue)} hint={`${overview.saleCount} bookings`} />
        <StatCard label="Collected" value={formatPKRShort(overview.collected)} hint={`${formatPKRShort(overview.collectedThisMonth)} this month`} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Receivable" value={formatPKRShort(overview.receivable)} />
        <StatCard
          label="Overdue"
          value={formatPKRShort(overview.overdue)}
          className={overview.overdue > 0 ? "border-destructive/40" : undefined}
        />
        <StatCard
          label="Flagged for cancellation"
          value={overview.flagged}
          hint={overview.flagged > 0 ? "A Manager must decide" : "None"}
          className={overview.flagged > 0 ? "border-destructive/40" : undefined}
        />
        <StatCard label="Due in 30 days" value={overview.upcoming.length} hint="installments" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Collections by month</CardTitle>
            <CardDescription>Receipts that have cleared, this year</CardDescription>
          </CardHeader>
          <CardContent>
            <CollectionsChart data={overview.collectionsByMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unit status by project</CardTitle>
            <CardDescription>Count of units in each status</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusByProjectChart
              data={rows.map((r) => ({
                code: r.code ?? "",
                name: r.name ?? "",
                available: r.available ?? 0,
                on_hold: r.on_hold ?? 0,
                booked: r.booked ?? 0,
                sold: r.sold ?? 0,
                rented: r.rented ?? 0,
                blocked: r.blocked ?? 0,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Due in the next 30 days</CardTitle>
                <CardDescription>Installments coming up, soonest first</CardDescription>
              </div>
              <Link href="/recoveries" className="text-sm underline">
                Recoveries
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {overview.upcoming.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing falls due in the next 30 days.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Unit</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="pr-6 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.upcoming.map((i) => (
                    <TableRow key={i.installment_id}>
                      <TableCell className="pl-6">
                        <Link href={`/sales/${i.sale_id}`} className="font-medium hover:underline">
                          {i.unit_no}
                        </Link>
                        <div className="text-xs text-muted-foreground">{i.project_code}</div>
                      </TableCell>
                      <TableCell>{i.client_name}</TableCell>
                      <TableCell>{formatDate(i.due_date)}</TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">{formatPKR(i.outstanding)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Recent bookings</CardTitle>
                <CardDescription>The latest sales recorded</CardDescription>
              </div>
              <Link href="/sales" className="text-sm underline">
                All sales
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {overview.recentSales.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Unit</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Booked</TableHead>
                    <TableHead className="pr-6 text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.recentSales.map((s) => (
                    <TableRow key={s.sale_id}>
                      <TableCell className="pl-6">
                        <Link href={`/sales/${s.sale_id}`} className="font-medium hover:underline">
                          {s.unit_no}
                        </Link>
                        <div className="text-xs text-muted-foreground">{s.project_code}</div>
                      </TableCell>
                      <TableCell>
                        <div>{s.primary_client_name}</div>
                        <SaleStatusBadge status={s.status!} className="mt-1" />
                      </TableCell>
                      <TableCell>{formatDate(s.booking_date)}</TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">{formatPKR(s.final_price ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {overview.flagged > 0 && (
        <div role="alert" className="mt-6 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">
              {overview.flagged} {overview.flagged === 1 ? "sale has" : "sales have"} reached the project&apos;s limit for missed
              installments.
            </p>
            <p className="text-muted-foreground">
              Nothing is cancelled automatically.{" "}
              <Link href="/sales?status=active" className="underline">
                Review them
              </Link>{" "}
              and decide.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
