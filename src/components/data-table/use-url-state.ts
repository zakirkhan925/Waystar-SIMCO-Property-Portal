"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/** Read/update query-string state (filters, page, sort). Resets to page 1 unless `page` is being set. */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = useCallback(
    (updates: Record<string, string | number | undefined | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === null || v === "" || v === "all") next.delete(k);
        else next.set(k, String(v));
      }
      if (!("page" in updates)) next.delete("page");
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  return { params, set, pending };
}
