"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Home, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearch, type SearchHit } from "@/features/search/actions";

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => startTransition(async () => setHits(await globalSearch(query))), 200);
    return () => clearTimeout(t);
  }, [query]);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQuery("");
    router.push(hit.kind === "unit" ? `/units/${hit.id}` : `/clients/${hit.id}`);
  };

  const units = hits.filter((h) => h.kind === "unit");
  const clients = hits.filter((h) => h.kind === "client");

  return (
    <>
      <Button
        variant="outline"
        className="h-9 w-full justify-start gap-2 text-muted-foreground sm:w-72"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="truncate">Search unit, client, CNIC, phone…</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search units and clients">
        {/* Filtering happens server-side, so cmdk's own filter is disabled */}
        <Command shouldFilter={false}>
        <CommandInput placeholder="Unit no., client name, CNIC or phone…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{pending ? "Searching…" : query ? "No matches." : "Start typing to search."}</CommandEmpty>
          {units.length > 0 && (
            <CommandGroup heading="Units">
              {units.map((h) => (
                <CommandItem key={h.id} value={`unit-${h.id}`} onSelect={() => go(h)}>
                  <Home />
                  <div className="min-w-0">
                    <div className="truncate">{h.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{h.subtitle}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {clients.length > 0 && (
            <CommandGroup heading="Clients">
              {clients.map((h) => (
                <CommandItem key={h.id} value={`client-${h.id}`} onSelect={() => go(h)}>
                  <User />
                  <div className="min-w-0">
                    <div className="truncate">{h.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{h.subtitle}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
