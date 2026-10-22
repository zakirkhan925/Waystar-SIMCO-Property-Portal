import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInventorySummary } from "@/features/projects/queries";
import { requireRole } from "@/lib/auth/session";
import { PROJECT_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage() {
  await requireRole("super_admin", "manager");
  const rows = await getInventorySummary();
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Settings", href: "/settings" }, { label: "Projects" }]}
        title="Projects"
        actions={
          <Button size="sm" asChild>
            <Link href="/settings/projects/new">
              <Plus /> New project
            </Link>
          </Button>
        }
      />
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Units</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.project_id}>
                <TableCell>
                  <Link href={`/settings/projects/${p.project_id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{p.code}</Badge>
                </TableCell>
                <TableCell>{p.type === "plot_society" ? "Plots" : "High-rise"}</TableCell>
                <TableCell>{p.project_status ? PROJECT_STATUS_LABELS[p.project_status] : ""}</TableCell>
                <TableCell className="text-right tabular-nums">{p.total_units}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
