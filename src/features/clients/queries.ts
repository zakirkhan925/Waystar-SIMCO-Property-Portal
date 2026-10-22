import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ClientListParams } from "./schemas";

const LIST_COLUMNS = "id, full_name, relation_type, guardian_name, cnic, passport_no, phone, whatsapp, email, city, country, is_overseas, created_at";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

function searchClients(supabase: SupabaseServer, q: string | undefined, withCount: boolean) {
  let query = supabase
    .from("clients")
    .select(LIST_COLUMNS, withCount ? { count: "exact" } : undefined)
    .is("deleted_at", null);
  const term = q?.replace(/[%_,()]/g, " ").trim();
  if (term) {
    // "0300…" (local format) must match "+92 300…": drop leading zeros before matching digits
    const digits = term.replace(/\D/g, "").replace(/^0+/, "");
    const ors = [`full_name.ilike.%${term}%`, `passport_no.ilike.${term}%`];
    // CNIC / phone match on a digits-only column, so dashes, spaces and +92 don't matter
    if (digits.length >= 4) ors.push(`search_digits.ilike.%${digits}%`);
    query = query.or(ors.join(","));
  }
  return query;
}

export async function listClientsPage(p: ClientListParams) {
  const supabase = await createClient();
  const from = (p.page - 1) * p.size;
  const { data, count, error } = await searchClients(supabase, p.q, true)
    .order(p.sort, { ascending: p.dir === "asc" })
    .range(from, from + p.size - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export async function listClientsAll(q: string | undefined, cap = 10000) {
  const supabase = await createClient();
  const { data, error } = await searchClients(supabase, q, false).order("full_name").limit(cap);
  if (error) throw error;
  return data ?? [];
}

export type ClientListRow = Awaited<ReturnType<typeof listClientsAll>>[number];

export async function getClient(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  return data;
}

/** Short-lived signed URLs for a client's private documents. */
export async function getClientDocUrls(paths: Record<string, string | null>) {
  const supabase = await createClient();
  const entries = Object.entries(paths).filter(([, p]) => p) as [string, string][];
  if (entries.length === 0) return {} as Record<string, string>;
  const { data } = await supabase.storage.from("client-docs").createSignedUrls(entries.map(([, p]) => p), 300);
  const out: Record<string, string> = {};
  entries.forEach(([k], i) => {
    const url = data?.[i]?.signedUrl;
    if (url) out[k] = url;
  });
  return out;
}
