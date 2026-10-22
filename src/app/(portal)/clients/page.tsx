import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ClientSearch } from "@/features/clients/client-search";
import { ClientsTable } from "@/features/clients/clients-table";
import { listClientsPage } from "@/features/clients/queries";
import { clientListSchema } from "@/features/clients/schemas";
import { can, getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const params = clientListSchema.parse(sp);
  const [user, { rows, total }] = await Promise.all([getCurrentUser(), listClientsPage(params)]);

  return (
    <>
      <PageHeader
        title="Clients"
        description={
          user.role === "sales_agent"
            ? "Owners, buyers and tenants you have registered."
            : "Owners, buyers and tenants across all projects."
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/export/clients${params.q ? `?q=${encodeURIComponent(params.q)}` : ""}`}>
                <Download /> CSV
              </a>
            </Button>
            {can(user).createClients && (
              <Button size="sm" asChild>
                <Link href="/clients/new">
                  <Plus /> New client
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <ClientSearch initial={params.q} />
        <ClientsTable rows={rows} total={total} page={params.page} pageSize={params.size} sort={params.sort} dir={params.dir} />
      </div>
    </>
  );
}
