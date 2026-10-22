"use client";

import { LayoutGrid, Rows3, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUrlState } from "@/components/data-table/use-url-state";
import { CATEGORY_LABELS, UNIT_STATUS_LABELS } from "@/lib/labels";
import type { ProjectStructure } from "@/features/projects/queries";
import type { UnitFilters } from "./filters";

type Props = { filters: UnitFilters; structure: ProjectStructure; isPlotSociety: boolean };

function DebouncedInput({
  value,
  onCommit,
  ...props
}: { value: string; onCommit: (v: string) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    if (v === value) return;
    const t = setTimeout(() => onCommit(v), 400);
    return () => clearTimeout(t);
  }, [v, value, onCommit]);
  return <Input value={v} onChange={(e) => setV(e.target.value)} {...props} />;
}

export function UnitFiltersBar({ filters, structure, isPlotSociety }: Props) {
  const { set } = useUrlState();
  const floors = structure.find((b) => b.id === filters.block)?.floors ?? [];
  const active =
    filters.q || filters.block || filters.floor || filters.category || filters.status ||
    filters.minSize !== undefined || filters.maxSize !== undefined ||
    filters.minPrice !== undefined || filters.maxPrice !== undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DebouncedInput
          value={filters.q ?? ""}
          onCommit={(q) => set({ q })}
          placeholder={isPlotSociety ? "Plot no." : "Unit no."}
          className="h-8 w-28"
          aria-label="Search unit number"
        />
        <Select value={filters.block ?? "all"} onValueChange={(v) => set({ block: v, floor: undefined })}>
          <SelectTrigger size="sm" className="w-36" aria-label={isPlotSociety ? "Block" : "Tower"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isPlotSociety ? "All blocks" : "All towers"}</SelectItem>
            {structure.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isPlotSociety && (
          <Select value={filters.floor ?? "all"} onValueChange={(v) => set({ floor: v })} disabled={!filters.block}>
            <SelectTrigger size="sm" className="w-32" aria-label="Floor">
              <SelectValue placeholder="All floors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All floors</SelectItem>
              {floors.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!isPlotSociety && (
          <Select value={filters.category ?? "all"} onValueChange={(v) => set({ category: v })}>
            <SelectTrigger size="sm" className="w-36" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(["shop", "office", "apartment", "penthouse", "other"] as const).map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filters.status ?? "all"} onValueChange={(v) => set({ status: v })}>
          <SelectTrigger size="sm" className="w-32" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(UNIT_STATUS_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center rounded-lg border p-0.5">
          <Button
            variant={filters.view === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => set({ view: "grid" })}
            aria-pressed={filters.view === "grid"}
          >
            <LayoutGrid /> Grid
          </Button>
          <Button
            variant={filters.view === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => set({ view: "table" })}
            aria-pressed={filters.view === "table"}
          >
            <Rows3 /> Table
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-muted-foreground sm:w-auto">Sq ft</span>
          <DebouncedInput value={filters.minSize?.toString() ?? ""} onCommit={(v) => set({ minSize: v })} inputMode="numeric" placeholder="Min" className="h-8 w-24" aria-label="Minimum size" />
          <DebouncedInput value={filters.maxSize?.toString() ?? ""} onCommit={(v) => set({ maxSize: v })} inputMode="numeric" placeholder="Max" className="h-8 w-24" aria-label="Maximum size" />
        </div>
        <div className="flex items-center gap-2 sm:ml-2">
          <span className="w-16 shrink-0 text-muted-foreground sm:w-auto">Price Rs</span>
          <DebouncedInput value={filters.minPrice?.toString() ?? ""} onCommit={(v) => set({ minPrice: v })} inputMode="numeric" placeholder="Min" className="h-8 w-28" aria-label="Minimum price" />
          <DebouncedInput value={filters.maxPrice?.toString() ?? ""} onCommit={(v) => set({ maxPrice: v })} inputMode="numeric" placeholder="Max" className="h-8 w-28" aria-label="Maximum price" />
        </div>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              set({ q: undefined, block: undefined, floor: undefined, category: undefined, status: undefined,
                    minSize: undefined, maxSize: undefined, minPrice: undefined, maxPrice: undefined })
            }
          >
            <X /> Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
