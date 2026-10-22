import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getProject, getProjectStructure } from "@/features/projects/queries";
import { UnitForm } from "@/features/units/unit-form";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add unit" };

export default async function NewUnitPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireRole("super_admin", "manager");
  const { projectId } = await params;
  const [project, structure] = await Promise.all([getProject(projectId), getProjectStructure(projectId)]);
  if (!project) notFound();
  const isPlotSociety = project.type === "plot_society";

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Projects", href: "/projects" }, { label: project.name, href: `/projects/${projectId}` }, { label: "Add" }]}
        title={`Add ${isPlotSociety ? "plot" : "unit"} — ${project.name}`}
      />
      {structure.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm">
          This project has no {isPlotSociety ? "blocks" : "towers"} yet.{" "}
          <Link className="underline" href={`/settings/projects/${projectId}`}>
            Add them in project settings
          </Link>{" "}
          first.
        </p>
      ) : (
        <UnitForm projectId={projectId} isPlotSociety={isPlotSociety} sqftPerMarla={Number(project.sqft_per_marla)} structure={structure} />
      )}
    </>
  );
}
