"use client";

import type { FormEvent } from "react";
import { useUrlState } from "@/components/data-table/use-url-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAYMENT_MODE_LABELS } from "@/features/sales/schemas";
import { PAYMENT_STATUS_LABELS, type PaymentFilters } from "./filters";

export function PaymentsFilters({
  projects,
  initial,
}: {
  projects: { id: string; name: string }[];
  initial: PaymentFilters;
}) {
  const { set, pending } = useUrlState();
  const from = initial.from === "any" ? "" : initial.from;
  const to = initial.to === "any" ? "" : initial.to;
  const selectClass = "h-9 rounded-md border bg-background px-2 text-sm";

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    set({
      q: value("q"),
      project: value("project"),
      from: value("from") || "any",
      to: value("to") || "any",
      mode: value("mode"),
      status: value("status"),
    });
  }

  return (
    <form key={JSON.stringify(initial)} onSubmit={apply} className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-sm">
        Search
        <Input name="q" defaultValue={initial.q} maxLength={80} placeholder="Receipt, buyer, plot or instrument" className="w-64" />
      </label>
      <label className="grid gap-1 text-sm">
        Project
        <select name="project" defaultValue={initial.project ?? ""} className={selectClass}>
          <option value="">All projects</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Received from
        <Input type="date" name="from" defaultValue={from} />
      </label>
      <label className="grid gap-1 text-sm">
        Received to
        <Input type="date" name="to" defaultValue={to} />
      </label>
      <label className="grid gap-1 text-sm">
        Mode
        <select name="mode" defaultValue={initial.mode ?? ""} className={selectClass}>
          <option value="">All modes</option>
          {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Status
        <select name="status" defaultValue={initial.status ?? ""} className={selectClass}>
          <option value="">All statuses</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <Button type="submit" disabled={pending}>Apply filters</Button>
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={(event) => {
          event.currentTarget.form?.reset();
          set({ q: null, project: null, from: null, to: null, mode: null, status: null });
        }}
      >
        Reset filters
      </Button>
    </form>
  );
}
