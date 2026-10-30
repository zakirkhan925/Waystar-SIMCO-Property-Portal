"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { formatDate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { SaleStatusBadge } from "./badges";
import type { SaleRow } from "./queries";

const columns: ColumnDef<SaleRow, unknown>[] = [
  {
    id: "unit_no",
    header: "Unit",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.unit_no}</div>
        <div className="text-xs text-muted-foreground">
          {[row.original.project_code, row.original.block_name, row.original.street, row.original.floor_label]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
    ),
  },
  {
    id: "buyer",
    header: "Buyer",
    cell: ({ row }) => (
      <div>
        <div>{row.original.primary_client_name}</div>
        <div className="text-xs text-muted-foreground">
          {row.original.primary_client_cnic}
          {(row.original.buyer_count ?? 1) > 1 ? ` +${(row.original.buyer_count ?? 1) - 1} more` : ""}
        </div>
      </div>
    ),
  },
  { id: "booking_date", header: "Booked", cell: ({ row }) => formatDate(row.original.booking_date) },
  {
    id: "final_price",
    header: "Price",
    cell: ({ row }) => formatPKR(row.original.final_price),
    meta: { className: "text-right tabular-nums" },
  },
  {
    id: "paid",
    header: "Received",
    cell: ({ row }) => (
      <div>
        <div>{formatPKR(row.original.total_paid ?? 0)}</div>
        <div className="text-xs text-muted-foreground">{Number(row.original.pct_paid ?? 0)}%</div>
      </div>
    ),
    meta: { className: "text-right tabular-nums" },
  },
  {
    id: "balance",
    header: "Balance",
    cell: ({ row }) => (
      <div>
        <div>{formatPKR(row.original.balance ?? 0)}</div>
        {Number(row.original.overdue_amount ?? 0) > 0 && (
          <div className="text-xs text-rose-600 dark:text-rose-400">{formatPKR(row.original.overdue_amount)} overdue</div>
        )}
      </div>
    ),
    meta: { className: "text-right tabular-nums" },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5">
        <SaleStatusBadge status={row.original.status!} />
        {row.original.cancellation_due && (
          <AlertTriangle className="size-3.5 text-destructive" aria-label="Cancellation due" />
        )}
      </span>
    ),
  },
];

export function SalesTable(props: {
  rows: SaleRow[];
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
      sortable={["unit_no", "booking_date", "final_price", "balance"]}
      emptyText="No bookings yet."
      onRowClick={(s) => router.push(`/sales/${s.sale_id}`)}
    />
  );
}
