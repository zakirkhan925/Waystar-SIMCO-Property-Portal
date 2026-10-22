"use client";

import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { UnitStatusBadge } from "@/components/status-badge";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatPKR } from "@/lib/money";
import type { UnitListRow } from "./queries";
import { formatSize, unitFeatures } from "./format";

const columns: ColumnDef<UnitListRow, unknown>[] = [
  { id: "unit_no", header: "Unit", cell: ({ row }) => <span className="font-medium">{row.original.unit_no}</span> },
  {
    id: "location",
    header: "Location",
    cell: ({ row }) =>
      [row.original.blocks?.name, row.original.street, row.original.floors?.label].filter(Boolean).join(" · "),
  },
  { id: "category", header: "Category", cell: ({ row }) => CATEGORY_LABELS[row.original.category] },
  {
    id: "area_sqft",
    header: "Size",
    cell: ({ row }) => formatSize(row.original.size_value, row.original.size_unit, row.original.area_sqft),
  },
  { id: "bedrooms", header: "Beds", cell: ({ row }) => row.original.bedrooms ?? "—", meta: { className: "text-center" } },
  {
    id: "features",
    header: "Features",
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{unitFeatures(row.original).join(", ") || "—"}</span>,
  },
  {
    id: "base_price",
    header: "Base price",
    cell: ({ row }) => formatPKR(row.original.base_price),
    meta: { className: "text-right tabular-nums" },
  },
  { id: "status", header: "Status", cell: ({ row }) => <UnitStatusBadge status={row.original.status} /> },
];

export function UnitsTable(props: {
  rows: UnitListRow[];
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
      sortable={["unit_no", "category", "area_sqft", "base_price", "status"]}
      emptyText="No units match these filters."
      onRowClick={(u) => router.push(`/units/${u.id}`)}
    />
  );
}
