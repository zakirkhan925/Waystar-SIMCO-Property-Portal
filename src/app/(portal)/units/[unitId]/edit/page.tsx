import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getProject, getProjectStructure } from "@/features/projects/queries";
import { getUnit } from "@/features/units/queries";
import { UnitForm } from "@/features/units/unit-form";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Edit unit" };

export default async function EditUnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  await requireRole("super_admin", "manager");
  const { unitId } = await params;
  const unit = await getUnit(unitId);
  if (!unit) notFound();
  const [project, structure] = await Promise.all([getProject(unit.project_id), getProjectStructure(unit.project_id)]);
  if (!project) notFound();

  const locked = !["available", "on_hold", "blocked"].includes(unit.status);

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Projects", href: "/projects" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: unit.unit_no, href: `/units/${unit.id}` },
          { label: "Edit" },
        ]}
        title={`Edit ${unit.unit_no}`}
      />
      <UnitForm
        projectId={project.id}
        isPlotSociety={project.type === "plot_society"}
        sqftPerMarla={Number(project.sqft_per_marla)}
        structure={structure}
        unitId={unit.id}
        statusLocked={locked}
        initial={{
          block_id: unit.block_id ?? "",
          floor_id: unit.floor_id ?? "",
          street: unit.street ?? "",
          unit_no: unit.unit_no,
          category: unit.category,
          use: unit.use,
          size_value: String(unit.size_value),
          size_unit: unit.size_unit,
          width_ft: unit.width_ft?.toString() ?? "",
          depth_ft: unit.depth_ft?.toString() ?? "",
          bedrooms: unit.bedrooms?.toString() ?? "",
          bathrooms: unit.bathrooms?.toString() ?? "",
          is_corner: unit.is_corner,
          is_park_facing: unit.is_park_facing,
          is_main_boulevard: unit.is_main_boulevard,
          base_price: String(unit.base_price),
          price_per_sqft: unit.price_per_sqft?.toString() ?? "",
          status: locked ? "available" : (unit.status as "available" | "on_hold" | "blocked"),
          notes: unit.notes ?? "",
          reason: "",
        }}
      />
    </>
  );
}
