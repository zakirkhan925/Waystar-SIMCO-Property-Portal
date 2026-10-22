"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchHit = {
  kind: "unit" | "client";
  id: string;
  title: string;
  subtitle: string;
  projectId: string | null;
};

/** Global search across units (unit no.) and clients (name, CNIC, phone, passport). RLS applies. */
export async function globalSearch(q: string): Promise<SearchHit[]> {
  const term = q.trim();
  if (term.length < 1) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("global_search", { p_q: term.slice(0, 60), p_limit: 8 });
  if (error || !data) return [];
  return data.map((r) => ({
    kind: r.kind as SearchHit["kind"],
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    projectId: r.project_id,
  }));
}
