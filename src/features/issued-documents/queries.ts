import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listIssuedDocuments(page: number) {
  const supabase = await createClient();
  const pageSize = 25;
  const start = (page - 1) * pageSize;
  const { data, error, count } = await supabase.from("issued_documents")
    .select("id, token, ref_no, doc_type, issued_at, revoked_at, revoked_reason, profiles(full_name), sales(units(unit_no)), leases(units(unit_no))", { count: "exact" })
    .order("issued_at", { ascending: false }).order("id", { ascending: false })
    .range(start, start + pageSize - 1);

  if (error && error.code !== "PGRST103") throw error;
  return { rows: data ?? [], hasNext: (count ?? 0) > start + pageSize };
}
