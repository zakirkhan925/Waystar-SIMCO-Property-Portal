import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/features/clients/client-form";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireRole("super_admin", "manager", "sales_agent");
  return (
    <>
      <PageHeader crumbs={[{ label: "Clients", href: "/clients" }, { label: "New" }]} title="New client" />
      <ClientForm />
    </>
  );
}
