import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { ActivityList } from "@/components/activity-list";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PageHeader } from "@/components/layout/page-header";
import { UnitStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteUnit } from "@/features/units/actions";
import { formatSize, unitFeatures, unitTitle } from "@/features/units/format";
import { getActivity, getUnit } from "@/features/units/queries";
import { getOwnershipHistory, getUnitSale } from "@/features/sales/queries";
import { UnitSalePanel } from "@/features/sales/unit-sale-panel";
import { UnitStatusDialog } from "@/features/units/status-dialog";
import { can, getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatPKR } from "@/lib/money";

type Props = { params: Promise<{ unitId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const unit = await getUnit((await params).unitId);
  return { title: unit ? `${unit.projects?.code} ${unit.unit_no}` : "Unit" };
}

function Spec({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export default async function UnitPage({ params }: Props) {
  const { unitId } = await params;
  const [user, unit] = await Promise.all([getCurrentUser(), getUnit(unitId)]);
  if (!unit) notFound();

  const perms = can(user);
  const [activity, sale, ownership] = await Promise.all([
    perms.viewActivity ? getActivity("units", unitId) : Promise.resolve([]),
    getUnitSale(unitId),
    getOwnershipHistory(unitId),
  ]);
  const canBook = perms.createClients && unit.status === "available";
  const manualStatus = ["available", "on_hold", "blocked"].includes(unit.status);
  const features = unitFeatures(unit);

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Projects", href: "/projects" },
          { label: unit.projects?.name ?? "Project", href: `/projects/${unit.project_id}` },
          { label: unit.unit_no },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {unitTitle(unit)} <UnitStatusBadge status={unit.status} />
          </span>
        }
        description={[unit.blocks?.name, unit.street, unit.floors?.label && `${unit.floors.label} floor`].filter(Boolean).join(" · ")}
        actions={
          <>
            {canBook && (
              <Button size="sm" asChild>
                <Link href={`/bookings/new?unit=${unit.id}`}>Book this unit</Link>
              </Button>
            )}
            {perms.manageInventory && (
              <>
              {manualStatus && <UnitStatusDialog unitId={unit.id} current={unit.status} />}
              <Button variant="outline" size="sm" asChild>
                <Link href={`/units/${unit.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
              {perms.softDelete && manualStatus && (
                <ConfirmDelete
                  title={`Delete ${unit.unit_no}?`}
                  description="The unit is hidden from inventory. Its history stays in the activity log."
                  action={deleteUnit.bind(null, unit.id)}
                  redirectTo={`/projects/${unit.project_id}`}
                />
              )}
              </>
            )}
          </>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ownership">Ownership & sale</TabsTrigger>
          {perms.viewActivity && <TabsTrigger value="activity">Activity</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Specifications</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Spec label="Project" value={unit.projects?.name} />
                <Spec label={unit.projects?.type === "plot_society" ? "Block" : "Tower"} value={unit.blocks?.name ?? "—"} />
                {unit.street && <Spec label="Street" value={unit.street} />}
                {unit.floors && <Spec label="Floor" value={unit.floors.label} />}
                <Spec label="Unit no." value={unit.unit_no} />
                <Spec label="Category" value={CATEGORY_LABELS[unit.category]} />
                <Spec label="Use" value={unit.use === "residential" ? "Residential" : "Commercial"} />
                {unit.width_ft && <Spec label="Area" value={`${Number(unit.area_sqft).toLocaleString("en-PK")} sq ft`} />}
                <Spec label="Size" value={formatSize(unit.size_value, unit.size_unit, unit.area_sqft, unit)} />
                {unit.bedrooms !== null && <Spec label="Bedrooms" value={unit.bedrooms} />}
                {unit.bathrooms !== null && <Spec label="Bathrooms" value={unit.bathrooms} />}
                <Spec
                  label="Features"
                  value={
                    features.length ? (
                      <span className="flex flex-wrap gap-1">
                        {features.map((f) => (
                          <Badge key={f} variant="secondary">
                            {f}
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
                <Spec label="Added" value={formatDate(unit.created_at)} />
              </dl>
              {unit.notes && <p className="mt-4 rounded-md bg-muted p-3 text-sm">{unit.notes}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <Spec label="Base price" value={<span className="text-lg">{formatPKR(unit.base_price)}</span>} />
                <Spec label="Price per sq ft" value={unit.price_per_sqft === null ? "—" : formatPKR(unit.price_per_sqft)} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ownership" className="mt-4">
          <UnitSalePanel unitId={unit.id} sale={sale} history={ownership} canBook={canBook} />
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
