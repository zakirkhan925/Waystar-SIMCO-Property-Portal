import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toDecimal } from "@/lib/money";
import { paymentStatus, type PaymentFilters } from "./filters";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const REGISTER_COLUMNS = `id, sale_id, received_on, receipt_no, mode, bank_name, instrument_no,
  instrument_date, amount::text, status, instrument_status,
  sales(units(unit_no, projects(name)), sale_buyers(is_primary, clients(full_name)))`;
const TOTAL_COLUMNS = "id, received_on, amount::text, status, instrument_status";
const SEARCH_EMBEDS = ", plot_match:sales(units!inner()), buyer_match:sales(sale_buyers!inner(clients!inner()))";
const BATCH_SIZE = 500;

function filteredPayments<Columns extends string>(
  supabase: SupabaseServer,
  filters: PaymentFilters,
  columns: Columns,
  withCount = false,
) {
  const term = filters.q;
  let query = supabase.from("payments").select(
    // The search-only embeds add no fields to the selected rows.
    `${columns}${term ? SEARCH_EMBEDS : ""}` as Columns,
    withCount ? { count: "exact" } : undefined,
  );
  if (filters.project) query = query.eq("project_id", filters.project);
  if (filters.from !== "any") query = query.gte("received_on", filters.from);
  if (filters.to !== "any") query = query.lte("received_on", filters.to);
  if (filters.mode) query = query.eq("mode", filters.mode);
  if (filters.status === "reversed") {
    query = query.eq("status", "reversed");
  } else if (filters.status) {
    query = query.eq("status", "valid").in(
      "instrument_status",
      filters.status === "cleared" ? ["cleared", "not_applicable"] : [filters.status],
    );
  }

  if (term) {
    // Match literal substrings and quote the operands inside PostgREST's OR syntax.
    const pattern = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const operand = `"${pattern.replace(/[\\"]/g, "\\$&")}"`;
    query = query
      .filter("plot_match.units.unit_no", "imatch", pattern)
      .filter("buyer_match.sale_buyers.clients.full_name", "imatch", pattern)
      .or(`receipt_no.imatch.${operand},instrument_no.imatch.${operand},plot_match.not.is.null,buyer_match.not.is.null`);
  }
  return query.order("received_on", { ascending: false }).order("id", { ascending: false });
}

export async function listPaymentsPage(filters: PaymentFilters & { page: number; size: number }) {
  const supabase = await createClient();
  const load = (page: number) => {
    const from = (page - 1) * filters.size;
    return filteredPayments(supabase, filters, REGISTER_COLUMNS, true).range(from, from + filters.size - 1);
  };
  let page = filters.page;
  let result = await load(page);
  if (page > 1 && (result.error?.code === "PGRST103" || (!result.error && !result.data?.length))) {
    page = 1;
    result = await load(page);
  }
  if (result.error) throw result.error;
  return { rows: (result.data ?? []).map(registerRow), total: result.count ?? 0, page };
}

export type PaymentRow = Awaited<ReturnType<typeof listPaymentsPage>>["rows"][number];

type RegisterPayment = NonNullable<Awaited<ReturnType<typeof filteredPayments<typeof REGISTER_COLUMNS>>>["data"]>[number];

function registerRow({ sales, ...payment }: RegisterPayment) {
  const buyer = [...(sales?.sale_buyers ?? [])]
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) ||
      (a.clients?.full_name ?? "").localeCompare(b.clients?.full_name ?? ""))
    .flatMap((buyer) => buyer.clients ? [buyer.clients.full_name] : [])
    .join(", ");
  return { ...payment, buyer, plot: sales?.units?.unit_no, project: sales?.units?.projects?.name };
}

async function* paymentBatches<Columns extends typeof REGISTER_COLUMNS | typeof TOTAL_COLUMNS>(
  filters: PaymentFilters,
  columns: Columns,
) {
  const supabase = await createClient();
  let cursor: { id: string; received_on: string } | undefined;
  while (true) {
    const query = filteredPayments(supabase, filters, columns).limit(BATCH_SIZE);
    if (cursor) {
      const { id, received_on } = cursor;
      query.or(`received_on.lt.${received_on},and(received_on.eq.${received_on},id.lt.${id})`);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return;
    yield data;
    cursor = data[data.length - 1] as typeof cursor;
  }
}

export async function listPaymentsAll(filters: PaymentFilters) {
  const rows: PaymentRow[] = [];
  for await (const batch of paymentBatches(filters, REGISTER_COLUMNS)) rows.push(...batch.map(registerRow));
  return rows;
}

export async function paymentTotals(filters: PaymentFilters) {
  const empty = () => ({ count: 0, amount: toDecimal(0) });
  const totals = { cleared: empty(), pending: empty(), bounced: empty(), reversed: empty() };
  for await (const batch of paymentBatches(filters, TOTAL_COLUMNS)) {
    for (const payment of batch) {
      const total = totals[paymentStatus(payment)];
      total.count += 1;
      total.amount = total.amount.plus(payment.amount);
    }
  }
  return totals;
}
