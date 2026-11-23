import "server-only";

import { createClient } from "@/lib/supabase/server";
import { readBatches } from "@/lib/query-batches";
import { todayPK } from "@/lib/dates";
import { toDecimal } from "@/lib/money";
import type { Enums } from "@/types/database";

const leaseSelection = "*, projects(name, code), units(unit_no)" as const;

export type Lease = NonNullable<Awaited<ReturnType<typeof getLease>>>;

export async function getLease(leaseId: string) {
  const supabase = await createClient();
  const [lease, parties] = await Promise.all([
    supabase.from("leases").select(leaseSelection).eq("id", leaseId).maybeSingle(),
    supabase.from("v_lease_party_names").select("tenant_name, landlord_name").eq("lease_id", leaseId).maybeSingle(),
  ]);
  if (lease.error || parties.error) throw lease.error ?? parties.error;
  return lease.data && {
    ...lease.data,
    tenant_name: parties.data?.tenant_name ?? null,
    landlord_name: parties.data?.landlord_name ?? null,
  };
}

export async function listLeases(params: {
  project?: string; status?: Enums<"lease_status">; q?: string; clientId?: string; unitId?: string;
} = {}) {
  const supabase = await createClient();
  const rows = await readBatches((from, to) => {
    let query = supabase.from("leases").select(leaseSelection);
    if (params.project) query = query.eq("project_id", params.project);
    if (params.status) query = query.eq("status", params.status);
    if (params.clientId) query = query.or(`tenant_client_id.eq.${params.clientId},landlord_client_id.eq.${params.clientId}`);
    if (params.unitId) query = query.eq("unit_id", params.unitId);
    return query.order("start_date", { ascending: false }).order("id").range(from, to);
  });
  const names = new Map<string, { tenant_name: string | null; landlord_name: string | null }>();
  for (let offset = 0; offset < rows.length; offset += 200) {
    const { data, error } = await supabase.from("v_lease_party_names").select("*")
      .in("lease_id", rows.slice(offset, offset + 200).map((lease) => lease.id));
    if (error) throw error;
    for (const entry of data) if (entry.lease_id) names.set(entry.lease_id, entry);
  }
  const leases = rows.map((lease) => ({
    ...lease,
    tenant_name: names.get(lease.id)?.tenant_name ?? null,
    landlord_name: names.get(lease.id)?.landlord_name ?? null,
  }));
  const q = params.q?.toLowerCase();
  return q ? leases.filter((row) => [row.tenant_name, row.units?.unit_no, row.agreement_no]
    .some((value) => value?.toLowerCase().includes(q))) : leases;
}

export async function listRentalTotals(leases: Lease[]) {
  const ids = new Set(leases.map((lease) => lease.id));
  const month = todayPK().slice(0, 7);
  const supabase = await createClient();
  const [invoices, payments, receivables] = await Promise.all([
    readBatches((from, to) => supabase.from("v_rent_invoice_balances").select("lease_id, outstanding")
      .gte("period", `${month}-01`).lte("period", `${month}-28`).order("id").range(from, to)),
    readBatches((from, to) => supabase.from("v_rent_payment_totals").select("lease_id, rent_collected")
      .gte("effective_date", `${month}-01`).lte("effective_date", todayPK()).order("id").range(from, to)),
    readBatches((from, to) => supabase.from("v_rent_receivables").select("lease_id, outstanding")
      .gt("days_overdue", 0).order("id").range(from, to)),
  ]);
  const sum = <T extends { lease_id: string | null }>(rows: T[], value: (row: T) => number | null) =>
    rows.reduce((total, row) => row.lease_id && ids.has(row.lease_id) ? total.plus(value(row) ?? 0) : total, toDecimal(0));
  return {
    active: leases.filter((lease) => lease.status === "active").length,
    due: sum(invoices, (row) => row.outstanding),
    collected: sum(payments, (row) => row.rent_collected),
    overdue: sum(receivables, (row) => row.outstanding),
  };
}

export async function getLeaseActivity(id: string) {
  const supabase = await createClient();
  const [invoices, payments, deposits, payouts, events, ledger] = await Promise.all([
    readBatches((from, to) => supabase.from("v_rent_invoice_balances").select("*")
      .eq("lease_id", id).order("period").order("id").range(from, to)),
    readBatches((from, to) => supabase.from("v_rent_payment_totals").select("*")
      .eq("lease_id", id).order("received_on", { ascending: false }).order("id").range(from, to)),
    readBatches((from, to) => supabase.from("deposit_transactions").select("*")
      .eq("lease_id", id).order("txn_date", { ascending: false }).order("id").range(from, to)),
    readBatches((from, to) => supabase.from("owner_payouts").select("*")
      .eq("lease_id", id).order("paid_on", { ascending: false }).order("id").range(from, to)),
    readBatches((from, to) => supabase.from("lease_events").select("*")
      .eq("lease_id", id).order("event_date", { ascending: false }).order("id").range(from, to)),
    supabase.from("v_lease_ledger").select("*").eq("lease_id", id).single(),
  ]);
  if (ledger.error) throw ledger.error;
  return { invoices, payments, deposits, payouts, events, ledger: ledger.data };
}

export async function getLeaseOptions() {
  const supabase = await createClient();
  const [agents, dealers, defaults] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "sales_agent").eq("is_active", true).order("full_name"),
    supabase.from("dealers").select("id, name").eq("is_active", true).is("deleted_at", null).order("name"),
    supabase.from("company_settings").select("default_lease_commission_pct, default_rent_increment_pct").single(),
  ]);
  if (agents.error || dealers.error || defaults.error) throw agents.error ?? dealers.error ?? defaults.error;
  return { agents: agents.data, dealers: dealers.data, defaults: defaults.data };
}
