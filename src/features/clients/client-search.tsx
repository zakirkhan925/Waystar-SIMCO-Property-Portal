"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useUrlState } from "@/components/data-table/use-url-state";

export function ClientSearch({ initial }: { initial?: string }) {
  const { set } = useUrlState();
  const [q, setQ] = useState(initial ?? "");
  useEffect(() => {
    if (q === (initial ?? "")) return;
    const t = setTimeout(() => set({ q }), 350);
    return () => clearTimeout(t);
  }, [q, initial, set]);

  return (
    <div className="relative w-full sm:max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Name, CNIC, phone or passport"
        className="pl-8"
        aria-label="Search clients"
        autoFocus
      />
    </div>
  );
}
