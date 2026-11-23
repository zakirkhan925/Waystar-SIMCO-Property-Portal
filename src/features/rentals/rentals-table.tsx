"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import type { Lease } from "./queries";
import { LEASE_STATUS_LABELS } from "./terms";

const columns: ColumnDef<Lease>[] = [
  { header: "Agreement", accessorKey: "agreement_no", cell: ({ row }) => (
    <Link className="font-medium hover:underline" href={`/rentals/${row.original.id}`}>{row.original.agreement_no}</Link>
  ) },
  { id: "unit", header: "Unit", cell: ({ row: { original: lease } }) => (
    <div>{lease.units?.unit_no}<div className="text-xs text-muted-foreground">{lease.projects?.name}</div></div>
  ) },
  { id: "tenant", header: "Tenant", cell: ({ row }) => row.original.tenant_name ?? "—" },
  { id: "landlord", header: "Landlord", cell: ({ row: { original: lease } }) =>
    lease.landlord_name ?? (lease.landlord_client_id ? "—" : "SIMCO") },
  { id: "start", header: "Starts", cell: ({ row }) => formatDate(row.original.start_date) },
  { id: "end", header: "Ends", cell: ({ row }) => formatDate(row.original.end_date) },
  { id: "rent", header: "Monthly rent", cell: ({ row }) => formatPKR(row.original.current_rent) },
  { id: "status", header: "Status", cell: ({ row }) => (
    <Badge variant={row.original.status === "active" ? "default" : "secondary"}>
      {LEASE_STATUS_LABELS[row.original.status]}
    </Badge>
  ) },
];

export function RentalsTable({ rows, total, page, pageSize }: { rows: Lease[]; total: number; page: number; pageSize: number }) {
  return <DataTable columns={columns} data={rows} total={total} page={page} pageSize={pageSize} emptyText="No matching leases." />;
}
