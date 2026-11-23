"use client";

import { useId, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchClients } from "@/features/sales/actions";
import { formatDate } from "@/lib/dates";
import { formatPKR, parseMoney } from "@/lib/money";
import { createLease } from "./actions";
import { RentalField, termFields, type Option } from "./lease-fields";
import { leaseSchema } from "./schemas";
import { rentSchedule } from "./terms";

export function LeaseWizard({ unitId, landlords, agents, dealers, increment, commission }: {
  unitId: string; landlords: Option[]; agents: Option[]; dealers: Option[]; increment: string; commission: string;
}) {
  const router = useRouter();
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [tenant, setTenant] = useState<{ id: string; full_name: string } | null>(null);
  const [matches, setMatches] = useState<Awaited<ReturnType<typeof searchClients>>>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!search.trim() || tenant) return;
    let current = true;
    const timeout = setTimeout(async () => {
      const rows = await searchClients(search);
      if (current) setMatches(rows);
    }, 250);
    return () => { current = false; clearTimeout(timeout); };
  }, [search, tenant]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    values.unit_id = unitId;
    values.tenant_client_id = tenant?.id ?? "";
    const result = leaseSchema.safeParse(values);
    if (!result.success) {
      const issue = result.error.issues[0];
      setError(issue.path.length ? `Check ${String(issue.path[0]).replaceAll("_", " ")}. ${issue.message}` : issue.message);
      return;
    }
    setError("");
    setDraft(values);
  };

  const save = () => startTransition(async () => {
    if (!draft) return;
    const result = await createLease(draft);
    if (!result.ok) { setError(result.error); return; }
    toast.success(result.message);
    router.push(`/rentals/${result.data?.id}`);
  });

  const errors = error && <p role="alert" className="text-sm text-destructive">{error}</p>;

  if (draft) {
    const months = rentSchedule(draft.start_date, parseMoney(draft.monthly_rent), parseMoney(draft.increment_pct), 24);
    return (
      <Card>
        <CardHeader><CardTitle>Review lease and rent schedule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{tenant?.full_name} · {formatDate(draft.start_date)} to {formatDate(draft.end_date)}</p>
          <p className="text-sm text-muted-foreground">First 24 months. Billing stops at the end of the lease.</p>
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {months.map((month) => (
              <div key={month.period} className={`flex justify-between gap-3 rounded-md border px-3 py-2 text-sm ${month.period > draft.end_date ? "text-muted-foreground" : ""}`}>
                <dt>{formatDate(month.period)}</dt>
                <dd>{formatPKR(month.rent)}</dd>
              </div>
            ))}
          </dl>
          {errors}
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => {
              setFormValues(draft);
              setDraft(null);
              setError("");
            }}>Back</Button>
            <Button type="button" disabled={pending} onClick={save}>{pending ? "Creating…" : "Create lease"}</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Parties and lease terms</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <RentalField field={{ name: "landlord_client_id", label: "Landlord", options: landlords,
              value: formValues.landlord_client_id, required: landlords[0]?.value !== "" }} />
            <div className="space-y-1.5">
              <Label htmlFor={searchId}>Tenant</Label>
              {tenant ? (
                <div className="flex items-center justify-between rounded-md border px-3 text-sm">
                  {tenant.full_name}
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setTenant(null); setSearch(""); setMatches([]); }}>Change</Button>
                </div>
              ) : (
                <>
                  <Input id={searchId} placeholder="Find a client by name, CNIC or phone" value={search}
                    onChange={(event) => { setSearch(event.target.value); setMatches([]); }} />
                  {search.trim() && <ul className="max-h-48 overflow-y-auto rounded-md border">
                    {matches.map((client) => (
                      <li key={client.id}>
                        <button type="button" onClick={() => setTenant(client)} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
                          {client.full_name} · {client.cnic ?? client.phone}
                        </button>
                      </li>
                    ))}
                    {!matches.length && <li className="p-2 text-xs text-muted-foreground">Search results appear here.</li>}
                  </ul>}
                </>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {termFields({ increment_pct: increment, commission_pct: commission, ...formValues }).map((field) =>
              <RentalField key={field.name} field={field} />)}
            <RentalField field={{ name: "agent_id", label: "Agent", required: false, value: formValues.agent_id,
              options: [{ value: "", label: "No agent" }, ...agents] }} />
            <RentalField field={{ name: "dealer_id", label: "Dealer", required: false, value: formValues.dealer_id,
              options: [{ value: "", label: "No dealer" }, ...dealers] }} />
          </div>
          {errors}
          <Button type="submit">Preview rent schedule</Button>
        </form>
      </CardContent>
    </Card>
  );
}
