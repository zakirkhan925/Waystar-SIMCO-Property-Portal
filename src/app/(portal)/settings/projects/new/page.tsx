import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectForm } from "@/features/projects/project-form";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requireRole("super_admin", "manager");
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Settings", href: "/settings" }, { label: "Projects", href: "/settings/projects" }, { label: "New" }]}
        title="New project"
      />
      <ProjectForm />
    </>
  );
}
