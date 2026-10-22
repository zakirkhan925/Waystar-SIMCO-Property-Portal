"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useUrlState } from "./use-url-state";

export type ServerTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  sort?: string;
  dir?: "asc" | "desc";
  /** Column ids that can be sorted server-side. */
  sortable?: string[];
  emptyText?: string;
  onRowClick?: (row: T) => void;
};

/** TanStack table driven by URL state: pagination and sorting happen on the server. */
export function DataTable<T>({
  columns,
  data,
  total,
  page,
  pageSize,
  sort,
  dir = "asc",
  sortable = [],
  emptyText = "No records found.",
  onRowClick,
}: ServerTableProps<T>) {
  const { set, pending } = useUrlState();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const sorting: SortingState = sort ? [{ id: sort, desc: dir === "desc" }] : [];

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { sorting, pagination: { pageIndex: page - 1, pageSize } },
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const toggleSort = (id: string) => {
    const nextDir = sort === id && dir === "asc" ? "desc" : "asc";
    set({ sort: id, dir: nextDir });
  };

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <div className={cn("space-y-3", pending && "opacity-70 transition-opacity")}>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const id = header.column.id;
                  const canSort = sortable.includes(id);
                  const label = header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext());
                  const meta = header.column.columnDef.meta as { className?: string } | undefined;
                  return (
                    <TableHead key={header.id} className={meta?.className}>
                      {canSort ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(id)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {label}
                          {sort === id ? (
                            dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        label
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                    return (
                      <TableCell key={cell.id} className={meta?.className}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>
          {first}–{last} of {total.toLocaleString("en-PK")}
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => set({ size: v })}>
            <SelectTrigger size="sm" className="w-[110px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => set({ page: page - 1 })}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <span className="tabular-nums">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= pageCount}
            onClick={() => set({ page: page + 1 })}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
