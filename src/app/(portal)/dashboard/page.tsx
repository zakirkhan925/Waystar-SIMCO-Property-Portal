import type { Metadata } from "next";
import Link from "next/link";
import Decimal from "decimal.js";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusByProjectChart } from "@/features/dashboard/status-chart";
import { getInventorySummary } from "@/features/projects/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { formatPKRShort } from "@/lib/money";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [user, rows] = await Promise.all([getCurrentUser(), getInventorySummary()]);

  const sum = (k: "total_units" | "available" | "on_hold" | "booked" | "sold" | "rented" | "blocked") =>
    rows.reduce((n, r) => n + (r[k] ?? 0), 0);
  const unsoldValue = rows.reduce((d, r) => d.plus(r.unsold_inventory_value ?? 0), new Decimal(0));
  const listValue = rows.reduce((d, r) => d.plus(r.total_list_value ?? 0), new Decimal(0));

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.fullName.split(" ")[0]}`}
        description="Inventory across SIMCO projects. Sales, collections and rentals appear here as they're recorded."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total units" value={sum("total_units").toLocaleString("en-PK")} />
        <StatCard label="Available" value={sum("available").toLocaleString("en-PK")} hint={`${sum("on_hold")} on hold`} />
        <StatCard label="Booked" value={sum("booked").toLocaleString("en-PK")} />
        <StatCard label="Sold" value={sum("sold").toLocaleString("en-PK")} />
        <StatCard label="Rented" value={sum("rented").toLocaleString("en-PK")} />
        <StatCard label="Unsold inventory" value={formatPKRShort(unsoldValue.toString())} hint={`of ${formatPKRShort(listValue.toString())} list value`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
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

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Open a project to see its inventory</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Project</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Avail.</TableHead>
                  <TableHead className="pr-6 text-right">Unsold value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.project_id}>
                    <TableCell className="pl-6">
                      <Link href={`/projects/${r.project_id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.total_units}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.available}</TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">{formatPKRShort(r.unsold_inventory_value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
