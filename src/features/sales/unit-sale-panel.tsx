import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { SaleStatusBadge } from "./badges";
import type { getOwnershipHistory, getUnitSale } from "./queries";

type Sale = Awaited<ReturnType<typeof getUnitSale>>;
type History = Awaited<ReturnType<typeof getOwnershipHistory>>;

/** The "Ownership & sale" tab on a unit: who owns it now, the ledger, and the full history. */
export function UnitSalePanel({
  unitId,
  sale,
  history,
  canBook,
}: {
  unitId: string;
  sale: Sale;
  history: History;
  canBook: boolean;
}) {
  const current = history.filter((h) => h.valid_to === null);
  const past = history.filter((h) => h.valid_to !== null);

  if (!sale) {
    return (
      <Card>
        <CardContent className="space-y-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">This unit has never been booked.</p>
          {canBook && (
            <Button asChild>
              <Link href={`/bookings/new?unit=${unitId}`}>Book this unit</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                Sale <SaleStatusBadge status={sale.status!} />
              </CardTitle>
              <CardDescription>
                {sale.booking_form_no} · booked {formatDate(sale.booking_date)}
                {sale.agent_name ? ` · ${sale.agent_name}` : ""}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/sales/${sale.sale_id}`}>Open sale</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Sale price</dt>
              <dd className="font-semibold tabular-nums">{formatPKR(sale.final_price)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Received</dt>
              <dd className="font-semibold tabular-nums">{formatPKR(sale.total_paid ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Balance</dt>
              <dd className="font-semibold tabular-nums">{formatPKR(sale.balance ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Overdue</dt>
              <dd className="font-semibold tabular-nums">{formatPKR(sale.overdue_amount ?? 0)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current owners</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {current.length === 0 && <p className="text-sm text-muted-foreground">No owner recorded.</p>}
          {current.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2">
              <Link href={`/clients/${o.clients?.id}`} className="font-medium hover:underline">
                {o.clients?.full_name}
              </Link>
              <span className="text-sm tabular-nums">{Number(o.share_pct)}%</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Ownership history</CardTitle>
          <CardDescription>Every owner this unit has had, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Owner</TableHead>
                <TableHead>Share</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="pr-6">Acquired</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...current, ...past].map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="pl-6">
                    <Link href={`/clients/${o.clients?.id}`} className="font-medium hover:underline">
                      {o.clients?.full_name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{o.clients?.cnic}</div>
                  </TableCell>
                  <TableCell className="tabular-nums">{Number(o.share_pct)}%</TableCell>
                  <TableCell>{formatDate(o.valid_from)}</TableCell>
                  <TableCell>{o.valid_to ? formatDate(o.valid_to) : <span className="text-muted-foreground">Current</span>}</TableCell>
                  <TableCell className="pr-6 capitalize">{o.acquired_via}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
