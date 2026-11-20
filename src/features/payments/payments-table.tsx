"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, FileText } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { ReceiptStatusBadge } from "@/features/sales/badges";
import { PAYMENT_MODE_LABELS } from "@/features/sales/schemas";
import { formatDate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import type { PaymentRow } from "./queries";

const columns: ColumnDef<PaymentRow>[] = [
  { id: "received_on", header: "Received", cell: ({ row }) => formatDate(row.original.received_on), meta: { className: "whitespace-nowrap" } },
  { accessorKey: "receipt_no", header: "Receipt no.", meta: { className: "whitespace-nowrap font-mono text-xs" } },
  { id: "buyer", header: "Buyer", cell: ({ row }) => row.original.buyer || "—" },
  { id: "project", header: "Project", cell: ({ row }) => row.original.project ?? "—" },
  { id: "plot", header: "Plot", cell: ({ row }) => row.original.plot ?? "—" },
  { id: "mode", header: "Mode", cell: ({ row }) => PAYMENT_MODE_LABELS[row.original.mode] },
  { id: "bank_name", header: "Bank", cell: ({ row }) => row.original.bank_name ?? "—" },
  {
    id: "instrument",
    header: "Instrument no. & date",
    cell: ({ row }) => (
      <div>
        <div>{row.original.instrument_no ?? "—"}</div>
        {row.original.instrument_date && (
          <div className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.original.instrument_date)}</div>
        )}
      </div>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    cell: ({ row }) => formatPKR(row.original.amount),
    meta: { className: "whitespace-nowrap text-right tabular-nums" },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <ReceiptStatusBadge status={row.original.status} instrument={row.original.instrument_status} />,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/sales/${row.original.sale_id}`} aria-label={`Open sale for ${row.original.receipt_no}`} title="Open sale">
            <ExternalLink />
          </Link>
        </Button>
        <Button variant="ghost" size="icon-sm" asChild>
          <a
            href={`/api/pdf/receipt/${row.original.id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Print receipt ${row.original.receipt_no} (opens in a new tab)`}
            title="Print receipt"
          >
            <FileText />
          </a>
        </Button>
      </div>
    ),
  },
];

export function PaymentsTable({ rows, total, page, pageSize }: { rows: PaymentRow[]; total: number; page: number; pageSize: number }) {
  return <DataTable columns={columns} data={rows} total={total} page={page} pageSize={pageSize} emptyText="No payments match these filters." />;
}
