"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useUrlState } from "@/components/data-table/use-url-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SALE_STATUS_LABELS } from "./schemas";

export function SalesFilters({
  projects,
  initial,
}: {
  projects: { id: string; name: string }[];
  initial: { q?: string; projectId?: string; status?: string };
}) {
  const { set } = useUrlState();
  const [q, setQ] = useState(initial.q ?? "");

  useEffect(() => {
    if (q === (initial.q ?? "")) return;
    const t = setTimeout(() => set({ q }), 350);
    return () => clearTimeout(t);
  }, [q, initial.q, set]);

  const active = initial.q || initial.projectId || initial.status;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Unit no., buyer or booking form no."
          className="pl-8"
          aria-label="Search bookings"
        />
      </div>
      <Select value={initial.projectId ?? "all"} onValueChange={(v) => set({ project: v })}>
        <SelectTrigger size="sm" className="w-44" aria-label="Project">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={initial.status ?? "all"} onValueChange={(v) => set({ status: v })}>
        <SelectTrigger size="sm" className="w-36" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {Object.entries(SALE_STATUS_LABELS).map(([k, label]) => (
            <SelectItem key={k} value={k}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => set({ q: undefined, project: undefined, status: undefined })}>
          <X /> Clear
        </Button>
      )}
    </div>
  );
}
