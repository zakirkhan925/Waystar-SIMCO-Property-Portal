import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

export type SaleListParams = {
  q?: string;
  projectId?: string;
  status?: Enums<"sale_status">;
  page: number;
  size: number;
  sort: "booking_date" | "final_price" | "unit_no" | "balance";
  dir: "asc" | "desc";
};

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

function filteredSales(supabase: SupabaseServer, p: SaleListParams, withCount: boolean) {
  let q = supabase.from("v_sale_summary").select("*", withCount ? { count: "exact" } : undefined);
  if (p.projectId) q = q.eq("project_id", p.projectId);
  if (p.status) q = q.eq("status", p.status);
  const term = p.q?.replace(/[%_,()]/g, " ").trim();
  if (term) {
    q = q.or(
      [`unit_no.ilike.%${term}%`, `booking_form_no.ilike.%${term}%`, `primary_client_name.ilike.%${term}%`].join(","),
    );
  }
  return q;
}

export async function listSalesPage(p: SaleListParams) {
  const supabase = await createClient();
  const from = (p.page - 1) * p.size;
  const { data, count, error } = await filteredSales(supabase, p, true)
    .order(p.sort, { ascending: p.dir === "asc" })
    .range(from, from + p.size - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export async function listSalesAll(p: SaleListParams, cap = 10000) {
  const supabase = await createClient();
  const { data, error } = await filteredSales(supabase, p, false).order("booking_date", { ascending: false }).limit(cap);
  if (error) throw error;
  return data ?? [];
}

export type SaleRow = Awaited<ReturnType<typeof listSalesAll>>[number];

/** Everything the sale page shows: sale, unit, buyers, ledger, schedule, receipts. */
export async function getSale(saleId: string) {
  const supabase = await createClient();
  const { data: sale } = await supabase
    .from("sales")
    .select(
      `*, projects(id, name, code, type),
       units(id, unit_no, street, category, size_value, size_unit, width_ft, depth_ft, area_sqft, status,
             blocks(name), floors(label)),
       sale_buyers(share_pct, is_primary, clients(id, full_name, cnic, passport_no, phone, whatsapp, email)),
       payment_plans(name)`,
    )
    .eq("id", saleId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!sale) return null;

  const [{ data: ledger }, { data: installments }, { data: payments }, { data: agent }] = await Promise.all([
    supabase.from("v_sale_ledger").select("*").eq("sale_id", saleId).maybeSingle(),
    supabase.from("installments").select("*").eq("sale_id", saleId).is("deleted_at", null).order("seq"),
    supabase
      .from("payments")
      .select("*, payment_allocations(amount, installment_id)")
      .eq("sale_id", saleId)
      .order("received_on", { ascending: false })
      .order("receipt_no", { ascending: false }),
    sale.agent_id
      ? supabase.from("profiles").select("full_name").eq("id", sale.agent_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    sale,
    ledger,
    installments: installments ?? [],
    payments: payments ?? [],
    agentName: agent?.full_name ?? null,
  };
}

export type SaleDetail = NonNullable<Awaited<ReturnType<typeof getSale>>>;
export type InstallmentRow = SaleDetail["installments"][number];
export type PaymentRow = SaleDetail["payments"][number];

/** The live sale on a unit, for the unit page. */
export async function getUnitSale(unitId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_sale_summary")
    .select("*")
    .eq("unit_id", unitId)
    .in("status", ["booked", "active", "completed"])
    .maybeSingle();
  return data;
}

/** Owners of a unit over time, newest first. */
export async function getOwnershipHistory(unitId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("unit_ownerships")
    .select("*, clients(id, full_name, cnic, phone)")
    .eq("unit_id", unitId)
    .order("valid_from", { ascending: false });
  return data ?? [];
}

/** Every sale a client is a buyer on. */
export async function getClientSales(clientId: string) {
  const supabase = await createClient();
  const { data: links } = await supabase.from("sale_buyers").select("sale_id, share_pct").eq("client_id", clientId);
  const ids = (links ?? []).map((l) => l.sale_id);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("v_sale_summary").select("*").in("sale_id", ids).order("booking_date", { ascending: false });
  const shares = new Map((links ?? []).map((l) => [l.sale_id, l.share_pct]));
  return (data ?? []).map((s) => ({ ...s, share_pct: shares.get(s.sale_id!) ?? 100 }));
}

export async function listPaymentPlans(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_plans")
    .select("*")
    .or(`project_id.eq.${projectId},project_id.is.null`)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("project_id", { nullsFirst: false })
    .order("name");
  return data ?? [];
}

export type PaymentPlan = Awaited<ReturnType<typeof listPaymentPlans>>[number];

export async function getUnitForBooking(unitId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("*, projects(id, name, code, type, corner_premium_pct, full_payment_possession_charge_pct, full_payment_discount_pct, down_payment_balance_days), blocks(name), floors(label)")
    .eq("id", unitId)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}
