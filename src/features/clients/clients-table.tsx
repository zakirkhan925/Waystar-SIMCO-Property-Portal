"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import type { ClientListRow } from "./queries";

const columns: ColumnDef<ClientListRow, unknown>[] = [
  {
    id: "full_name",
    header: "Name",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.full_name}</div>
        {row.original.guardian_name && (
          <div className="text-xs text-muted-foreground">
            {row.original.relation_type?.toUpperCase()} {row.original.guardian_name}
          </div>
        )}
      </div>
    ),
  },
  {
    id: "cnic",
    header: "CNIC / Passport",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.cnic ?? row.original.passport_no}</span>,
  },
  { id: "phone", header: "Phone", cell: ({ row }) => row.original.phone },
  {
    id: "city",
    header: "City",
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        {row.original.city ?? "—"}
        {row.original.is_overseas && <Badge variant="secondary">Overseas</Badge>}
      </span>
    ),
  },
  { id: "created_at", header: "Added", cell: ({ row }) => formatDate(row.original.created_at) },
];

export function ClientsTable(props: {
  rows: ClientListRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
}) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      data={props.rows}
      total={props.total}
      page={props.page}
      pageSize={props.pageSize}
      sort={props.sort}
      dir={props.dir}
      sortable={["full_name", "city", "created_at"]}
      emptyText="No clients found."
      onRowClick={(c) => router.push(`/clients/${c.id}`)}
    />
  );
}
