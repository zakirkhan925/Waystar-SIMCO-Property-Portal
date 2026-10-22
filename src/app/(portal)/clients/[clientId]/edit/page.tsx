import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/features/clients/client-form";
import { getClient } from "@/features/clients/queries";
import { getCurrentUser, hasRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const [user, c] = await Promise.all([getCurrentUser(), getClient(clientId)]);
  if (!c) notFound();
  const canEdit = hasRole(user, "super_admin", "manager") || (user.role === "sales_agent" && c.created_by === user.id);
  if (!canEdit) redirect(`/clients/${clientId}`);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Clients", href: "/clients" }, { label: c.full_name, href: `/clients/${c.id}` }, { label: "Edit" }]}
        title={`Edit ${c.full_name}`}
      />
      <ClientForm
        clientId={c.id}
        initial={{
          full_name: c.full_name,
          relation_type: (c.relation_type ?? "") as "s/o" | "d/o" | "w/o" | "",
          guardian_name: c.guardian_name ?? "",
          cnic: c.cnic ?? "",
          passport_no: c.passport_no ?? "",
          nationality: c.nationality,
          is_overseas: c.is_overseas,
          phone: c.phone,
          whatsapp: c.whatsapp ?? "",
          email: c.email ?? "",
          address: c.address ?? "",
          city: c.city ?? "",
          country: c.country,
          nok_name: c.nok_name ?? "",
          nok_cnic: c.nok_cnic ?? "",
          nok_relation: c.nok_relation ?? "",
          nok_phone: c.nok_phone ?? "",
          notes: c.notes ?? "",
        }}
      />
    </>
  );
}
