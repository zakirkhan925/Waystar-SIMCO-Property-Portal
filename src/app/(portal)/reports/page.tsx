import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENTS_ROLES } from "@/features/payments/filters";
import { parseReportFilters } from "@/features/reports/filters";
import { loadReports } from "@/features/reports/queries";
import { reportTables } from "@/features/reports/tables";
import { requireRole } from "@/lib/auth/session";
import { formatPKR } from "@/lib/money";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole(...PAYMENTS_ROLES);
  const filters = parseReportFilters(await searchParams);
  const report = await loadReports(filters);
  const params = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.project) params.set("project", filters.project);

  return (
    <>
      <PageHeader title="Reports" description="Inventory, sales, collections, recoveries and refunds by project." />
      <form action="/reports" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">
          Project
          <select name="project" defaultValue={filters.project ?? ""} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">All projects</option>
            {report.allProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          From
          <Input name="from" type="date" defaultValue={filters.from === "any" ? "" : filters.from} />
        </label>
        <label className="grid gap-1 text-sm">
          To
          <Input name="to" type="date" defaultValue={filters.to === "any" ? "" : filters.to} />
        </label>
        <Button type="submit">Apply filters</Button>
      </form>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Cleared collections" value={formatPKR(report.collections.statuses.cleared.amount)} />
        <StatCard label="Outstanding today" value={formatPKR(report.recoveries.outstanding)} />
        <StatCard label="Overdue today" value={formatPKR(report.recoveries.overdue)} />
        <StatCard label="Late charges outstanding" value={formatPKR(report.recoveries.lateCharges)} />
      </div>
      <div className="grid gap-4">
        {reportTables(report).map(({ id, title, headers, rows }) => (
          <Card key={id}>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{title}</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/export/reports/${id}?${params}`} aria-label={`Download CSV for ${title}`}>
                  <Download /> Download CSV
                </a>
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((header, index) => (
                      <TableHead key={header} className={index ? "text-right" : undefined}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={index}>
                      {row.map((value, column) => (
                        <TableCell key={column} className={column ? "text-right tabular-nums" : "font-medium"}>
                          {typeof value === "object" ? formatPKR(value) : value}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {!rows.length && (
                    <TableRow><TableCell colSpan={headers.length}>No matching projects.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
