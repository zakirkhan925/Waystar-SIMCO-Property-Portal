import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInventorySummary } from "@/features/projects/queries";
import { can, getCurrentUser } from "@/lib/auth/session";
import { PROJECT_STATUS_LABELS, UNIT_STATUS_STYLES, type UnitStatus } from "@/lib/labels";
import { formatPKRShort } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };

const BAR: UnitStatus[] = ["sold", "booked", "rented", "on_hold", "blocked", "available"];

export default async function ProjectsPage() {
  const [user, rows] = await Promise.all([getCurrentUser(), getInventorySummary()]);

  return (
    <>
      <PageHeader
        title="Projects & Inventory"
        description="Choose a project to see its units."
        actions={
          can(user).manageProjects && (
            <Button asChild>
              <Link href="/settings/projects/new">
                <Plus /> New project
              </Link>
            </Button>
          )
        }
      />
      {rows.length === 0 ? (
        <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          You don&apos;t have access to any projects yet. Ask an administrator to grant access.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const total = p.total_units ?? 0;
            return (
              <Link key={p.project_id} href={`/projects/${p.project_id}`} className="group">
                <Card className="h-full transition group-hover:ring-2 group-hover:ring-ring/40">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle>{p.name}</CardTitle>
                      <Badge variant="outline">{p.code}</Badge>
                    </div>
                    <CardDescription>
                      {p.type === "plot_society" ? "Residential plots" : "Shops · Offices · Apartments"} ·{" "}
                      {p.project_status ? PROJECT_STATUS_LABELS[p.project_status] : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                      {total > 0 &&
                        BAR.map((s) => {
                          const n = (p[s] as number | null) ?? 0;
                          return n ? (
                            <div key={s} className={cn("h-full border-0", UNIT_STATUS_STYLES[s])} style={{ width: `${(n / total) * 100}%` }} />
                          ) : null;
                        })}
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Units</dt>
                        <dd className="font-semibold tabular-nums">{total}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Available</dt>
                        <dd className="font-semibold tabular-nums">{p.available}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Unsold value</dt>
                        <dd className="font-semibold tabular-nums">{formatPKRShort(p.unsold_inventory_value)}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
