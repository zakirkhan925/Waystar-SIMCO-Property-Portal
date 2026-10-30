"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchClients } from "./actions";

export type PickedBuyer = { client_id: string; share_pct: string; is_primary: boolean; label: string };
type Client = { id: string; full_name: string; cnic: string | null; passport_no: string | null; phone: string };

export function BuyerPicker({
  value,
  onChange,
  error,
}: {
  value: PickedBuyer[];
  onChange: (next: PickedBuyer[]) => void;
  error?: string;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => startTransition(async () => setResults(await searchClients(term))), 250);
    return () => clearTimeout(t);
  }, [term]);

  const add = (c: Client) => {
    if (value.some((b) => b.client_id === c.id)) return;
    const next = [
      ...value,
      { client_id: c.id, share_pct: "0", is_primary: value.length === 0, label: c.full_name },
    ];
    onChange(evenShares(next));
    setTerm("");
  };

  const remove = (id: string) => {
    const next = value.filter((b) => b.client_id !== id);
    if (next.length > 0 && !next.some((b) => b.is_primary)) next[0].is_primary = true;
    onChange(evenShares(next));
  };

  const patch = (id: string, change: Partial<PickedBuyer>) =>
    onChange(
      value.map((b) =>
        b.client_id === id
          ? { ...b, ...change }
          : change.is_primary
            ? { ...b, is_primary: false } // only one primary buyer
            : b,
      ),
    );

  const total = value.reduce((n, b) => n + Number(b.share_pct || 0), 0);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="buyer-search">Find a client</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="buyer-search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Name, CNIC or phone"
            className="pl-8"
          />
        </div>
        {term && (
          <div className="max-h-56 overflow-y-auto rounded-lg border">
            {pending && results.length === 0 && <p className="p-3 text-sm text-muted-foreground">Searching…</p>}
            {!pending && results.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                No client found.{" "}
                <a href="/clients/new" target="_blank" rel="noopener noreferrer" className="underline">
                  Add one
                </a>
                , then search again.
              </p>
            )}
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => add(c)}
                disabled={value.some((b) => b.client_id === c.id)}
                className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted disabled:opacity-50"
              >
                <span>
                  <span className="font-medium">{c.full_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.cnic ?? c.passport_no} · {c.phone}
                  </span>
                </span>
                <Plus className="size-4 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((b) => (
            <div key={b.client_id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <span className="min-w-0 flex-1 font-medium">{b.label}</span>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={b.is_primary} onCheckedChange={() => patch(b.client_id, { is_primary: true })} />
                Primary
              </label>
              <div className="flex items-center gap-1">
                <Input
                  className="h-8 w-20 text-right"
                  inputMode="decimal"
                  value={b.share_pct}
                  onChange={(e) => patch(b.client_id, { share_pct: e.target.value })}
                  aria-label={`Share for ${b.label}`}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${b.label}`} onClick={() => remove(b.client_id)}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <p className={`text-sm ${Math.abs(total - 100) > 0.001 ? "text-destructive" : "text-muted-foreground"}`}>
            Shares total {total}% {Math.abs(total - 100) > 0.001 && "— they must add up to 100%"}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Split 100% evenly, giving the remainder to the first buyer so it always totals 100. */
function evenShares(buyers: PickedBuyer[]): PickedBuyer[] {
  if (buyers.length === 0) return buyers;
  const each = Math.floor((100 / buyers.length) * 100) / 100;
  return buyers.map((b, i) => ({
    ...b,
    share_pct: (i === 0 ? Number((100 - each * (buyers.length - 1)).toFixed(2)) : each).toString(),
  }));
}
