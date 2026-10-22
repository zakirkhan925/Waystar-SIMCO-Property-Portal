import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusLegend } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { getProject, getProjectStructure } from "@/features/projects/queries";
import { parseUnitFilters } from "@/features/units/filters";
import { listUnitsAll, listUnitsPage } from "@/features/units/queries";
import { UnitFiltersBar } from "@/features/units/unit-filters-bar";
import { UnitGrid } from "@/features/units/unit-grid";
import { UnitsTable } from "@/features/units/units-table";
import { can, getCurrentUser } from "@/lib/auth/session";
import { PROJECT_STATUS_LABELS } from "@/lib/labels";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject((await params).projectId);
  return { title: project?.name ?? "Project" };
}

export default async function ProjectInventoryPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const sp = await searchParams;
  const filters = parseUnitFilters(sp);

  const [user, project, structure] = await Promise.all([
    getCurrentUser(),
    getProject(projectId),
    getProjectStructure(projectId),
  ]);
  if (!project) notFound();

  const isPlotSociety = project.type === "plot_society";
  const exportQs = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && !["page", "size", "view"].includes(k) ? [[k, v]] : [])),
  );
  exportQs.set("projectId", projectId);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Projects", href: "/projects" }, { label: project.name }]}
        title={project.name}
        description={`${project.code} · ${project.location ?? ""} · ${PROJECT_STATUS_LABELS[project.status]}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/export/units?${exportQs}`}>
                <Download /> CSV
              </a>
            </Button>
            {can(user).manageProjects && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/settings/projects/${projectId}`}>
                  <Pencil /> Edit project
                </Link>
              </Button>
            )}
            {can(user).manageInventory && (
              <Button size="sm" asChild>
                <Link href={`/projects/${projectId}/units/new`}>
                  <Plus /> Add {isPlotSociety ? "plot" : "unit"}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4">
        <UnitFiltersBar filters={filters} structure={structure} isPlotSociety={isPlotSociety} />
        <StatusLegend />
        {filters.view === "grid" ? (
          <UnitGrid units={await listUnitsAll(projectId, filters)} isPlotSociety={isPlotSociety} />
        ) : (
          <UnitsTable
            {...(await listUnitsPage(projectId, filters))}
            page={filters.page}
            pageSize={filters.size}
            sort={filters.sort}
            dir={filters.dir}
          />
        )}
      </div>
    </>
  );
}
