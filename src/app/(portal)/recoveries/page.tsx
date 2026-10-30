import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { listRecoveries, recoverySummary, type RecoveryBucket } from "@/features/recoveries/queries";
import { RecoveriesTable } from "@/features/recoveries/recoveries-table";
import { listProjectsBrief } from "@/features/users/queries";
import { createClient } from "@/lib/supabase/server";
import { formatPKRShort } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Recoveries" };

const paramsSchema = z.object({
  bucket: z.enum(["all", "due_week", "overdue", "0_30", "31_60", "61_90", "90_plus"]).catch("overdue"),
  project: z.string().uuid().optional().catch(undefined),
});

const TABS: { key: RecoveryBucket; label: string }[] = [
  { key: "due_week", label: "Due this week" },
  { key: "overdue", label: "All overdue" },
  { key: "0_30", label: "1–30 days" },
  { key: "31_60", label: "31–60 days" },
  { key: "61_90", label: "61–90 days" },
  { key: "90_plus", label: "90+ days" },
  { key: "all", label: "Everything outstanding" },
];

export default async function RecoveriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const p = paramsSchema.parse(sp);
  const supabase = await createClient();

  const [rows, summary, projects, { data: company }] = await Promise.all([
    listRecoveries(p.bucket, p.project),
    recoverySummary(p.project),
    listProjectsBrief(),
    supabase.from("company_settings").select("company_name").single(),
  ]);

  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { bucket: p.bucket, project: p.project, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `/recoveries?${next}`;
  };

  return (
    <>
      <PageHeader
        title="Recoveries"
        description="Installments coming due and money already overdue, oldest first."
        actions={
          <div className="flex flex-wrap gap-1">
            <Button variant={p.project ? "ghost" : "secondary"} size="sm" asChild>
              <Link href={qs({ project: undefined })}>All projects</Link>
            </Button>
            {projects.map((pr) => (
              <Button key={pr.id} variant={p.project === pr.id ? "secondary" : "ghost"} size="sm" asChild>
                <Link href={qs({ project: pr.id })}>{pr.code}</Link>
              </Button>
            ))}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {(["not_due", "0_30", "31_60", "61_90", "90_plus"] as const).map((b) => (
          <StatCard
            key={b}
            label={{ not_due: "Not yet due", "0_30": "1–30 days", "31_60": "31–60 days", "61_90": "61–90 days", "90_plus": "90+ days" }[b]}
            value={formatPKRShort(summary.totals[b] ?? 0)}
            hint={`${summary.counts[b] ?? 0} installments`}
            className={b === "90_plus" && (summary.totals[b] ?? 0) > 0 ? "border-destructive/40" : undefined}
          />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b pb-2">
        {TABS.map((t) => (
          <Button key={t.key} variant={p.bucket === t.key ? "secondary" : "ghost"} size="sm" asChild>
            <Link href={qs({ bucket: t.key })} className={cn(p.bucket === t.key && "font-semibold")}>
              {t.label}
            </Link>
          </Button>
        ))}
      </div>

      <RecoveriesTable rows={rows} companyName={company?.company_name ?? "Waystar Royco Marketing"} />
    </>
  );
}
