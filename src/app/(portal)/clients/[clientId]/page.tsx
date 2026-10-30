import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Pencil, Phone } from "lucide-react";
import { ActivityList } from "@/components/activity-list";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteClient } from "@/features/clients/actions";
import { ClientDocuments } from "@/features/clients/client-documents";
import { getClient, getClientDocUrls } from "@/features/clients/queries";
import { getActivity } from "@/features/units/queries";
import { getClientSales } from "@/features/sales/queries";
import { SaleStatusBadge } from "@/features/sales/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can, getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";

type Props = { params: Promise<{ clientId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getClient((await params).clientId);
  return { title: c?.full_name ?? "Client" };
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{value || "—"}</dd>
    </div>
  );
}

const waLink = (n: string) => `https://wa.me/${n.replace(/\D/g, "").replace(/^0/, "92")}`;

export default async function ClientPage({ params }: Props) {
  const { clientId } = await params;
  const [user, client] = await Promise.all([getCurrentUser(), getClient(clientId)]);
  if (!client) notFound();

  const perms = can(user);
  const canEdit = perms.manageInventory || (user.role === "sales_agent" && client.created_by === user.id);
  const [docUrls, activity, sales] = await Promise.all([
    getClientDocUrls({ photo: client.photo_path, cnic_front: client.cnic_front_path, cnic_back: client.cnic_back_path }),
    perms.viewActivity ? getActivity("clients", clientId) : Promise.resolve([]),
    getClientSales(clientId),
  ]);
  const owned = sales.filter((s) => s.status !== "cancelled");
  const totalPaid = owned.reduce((n, s) => n + Number(s.total_paid ?? 0), 0);
  const outstanding = owned.reduce((n, s) => n + Number(s.balance ?? 0), 0);
  const whatsapp = client.whatsapp ?? client.phone;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Clients", href: "/clients" }, { label: client.full_name }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {client.full_name}
            {client.is_overseas && <Badge variant="secondary">Overseas</Badge>}
          </span>
        }
        description={client.guardian_name ? `${client.relation_type?.toUpperCase() ?? ""} ${client.guardian_name}` : undefined}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${client.phone.replace(/\s/g, "")}`}>
                <Phone /> Call
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={waLink(whatsapp)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/clients/${client.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            {perms.softDelete && (
              <ConfirmDelete
                title={`Delete ${client.full_name}?`}
                description="The client is hidden from lists. Their history stays in the activity log."
                action={deleteClient.bind(null, client.id)}
                redirectTo="/clients"
              />
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Units owned" value={owned.length} />
        <StatCard label="Units rented" value="0" hint="Rentals arrive in Phase 4" />
        <StatCard label="Total paid" value={formatPKR(totalPaid)} />
        <StatCard label="Outstanding" value={formatPKR(outstanding)} />
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
          {perms.viewActivity && <TabsTrigger value="activity">Activity</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Item label="CNIC" value={client.cnic && <span className="font-mono">{client.cnic}</span>} />
                <Item label="Passport no." value={client.passport_no} />
                <Item label="Nationality" value={client.nationality} />
                <Item label="Phone" value={client.phone} />
                <Item label="WhatsApp" value={client.whatsapp} />
                <Item label="Email" value={client.email} />
                <Item label="Address" value={client.address} />
                <Item label="City" value={client.city} />
                <Item label="Country" value={client.country} />
              </dl>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Next of kin</h3>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Item label="Name" value={client.nok_name} />
                  <Item label="Relation" value={client.nok_relation} />
                  <Item label="CNIC" value={client.nok_cnic} />
                  <Item label="Phone" value={client.nok_phone} />
                </dl>
              </div>
              {client.notes && <p className="rounded-md bg-muted p-3 text-sm">{client.notes}</p>}
              <p className="text-xs text-muted-foreground">Added {formatDate(client.created_at)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <ClientDocuments
                clientId={client.id}
                urls={docUrls}
                paths={{ photo: client.photo_path, cnic_front: client.cnic_front_path, cnic_back: client.cnic_back_path }}
                canUpload={canEdit}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="units" className="mt-4">
          {sales.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                This client has not booked a unit yet.
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Booked</TableHead>
                    <TableHead>Share</TableHead>
                    <TableHead className="text-right">Sale price</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((s) => (
                    <TableRow key={s.sale_id}>
                      <TableCell>
                        <Link href={`/sales/${s.sale_id}`} className="font-medium hover:underline">
                          {s.unit_no}
                        </Link>
                        <div className="text-xs text-muted-foreground">{s.project_name}</div>
                      </TableCell>
                      <TableCell>{formatDate(s.booking_date)}</TableCell>
                      <TableCell className="tabular-nums">{Number(s.share_pct)}%</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPKR(s.final_price ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPKR(s.total_paid ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPKR(s.balance ?? 0)}</TableCell>
                      <TableCell>
                        <SaleStatusBadge status={s.status!} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {perms.viewActivity && (
          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <ActivityList rows={activity} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
