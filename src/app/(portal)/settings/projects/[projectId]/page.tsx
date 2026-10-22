import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/features/projects/project-form";
import { getProject, getProjectStructure } from "@/features/projects/queries";
import { StructureEditor } from "@/features/projects/structure-editor";
import { can, requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireRole("super_admin", "manager");
  const { projectId } = await params;
  const [project, structure] = await Promise.all([getProject(projectId), getProjectStructure(projectId)]);
  if (!project) notFound();

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Settings", href: "/settings" }, { label: "Projects", href: "/settings/projects" }, { label: project.name }]}
        title={project.name}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/settings/projects/${project.id}/documents`}>Documents & letters</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${project.id}`}>View inventory</Link>
            </Button>
          </>
        }
      />
      <div className="space-y-6">
        <StructureEditor
          projectId={project.id}
          isPlotSociety={project.type === "plot_society"}
          structure={structure}
          canDelete={can(user).softDelete}
        />
        <ProjectForm
          projectId={project.id}
          initial={{
            name: project.name,
            code: project.code,
            type: project.type,
            status: project.status,
            location: project.location ?? "",
            description: project.description ?? "",
            sqft_per_marla: String(project.sqft_per_marla),
            marla_per_kanal: String(project.marla_per_kanal),
            late_fee_method: project.late_fee_method,
            late_fee_rate: String(project.late_fee_rate),
            late_fee_grace_days: String(project.late_fee_grace_days),
            late_fee_cap_pct: project.late_fee_cap_pct === null ? "" : String(project.late_fee_cap_pct),
            corner_premium_pct: String(project.corner_premium_pct),
            cancel_after_consecutive_missed: project.cancel_after_consecutive_missed === null ? "" : String(project.cancel_after_consecutive_missed),
            cancellation_deduction_pct: project.cancellation_deduction_pct === null ? "" : String(project.cancellation_deduction_pct),
            construction_min_paid_pct: project.construction_min_paid_pct === null ? "" : String(project.construction_min_paid_pct),
            full_payment_possession_charge_pct: String(project.full_payment_possession_charge_pct),
            down_payment_balance_days: project.down_payment_balance_days === null ? "" : String(project.down_payment_balance_days),
            sort_order: String(project.sort_order),
            is_active: project.is_active,
          }}
        />
      </div>
    </>
  );
}
