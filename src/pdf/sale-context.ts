import "server-only";
import Decimal from "decimal.js";
import { formatSize } from "@/features/units/format";
import { createClient } from "@/lib/supabase/server";
import type { DocContext, Party, ScheduleRow } from "./types";

/**
 * Real-sale data for a document. Everything is read with the signed-in user's client, so RLS
 * decides who may print what: an agent can only reach their own sales.
 */
type Client = {
  full_name: string;
  relation_type: string | null;
  guardian_name: string | null;
  cnic: string | null;
  passport_no: string | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
};

const party = (c: Client): Party => ({
  name: c.full_name,
  relation: c.relation_type?.toUpperCase() ?? null,
  guardian: c.guardian_name,
  cnic: c.cnic,
  passport: c.passport_no,
  nationality: c.nationality,
  address: [c.address, c.city, c.country].filter(Boolean).join(", ") || null,
  phone: c.phone,
  email: c.email,
});

const MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  cheque: "Cheque",
  pay_order: "Pay Order",
  bank_transfer: "Bank Transfer",
  online: "Online",
};
export const paymentModeLabel = (mode: string) => MODE_LABELS[mode] ?? mode;

/** SV-BF-2026-000001 -> SV-AL-2026-000001: one booking, one number, across all of its documents. */
export function documentRef(bookingFormNo: string, prefix: string) {
  return bookingFormNo.includes("-BF-") ? bookingFormNo.replace("-BF-", `-${prefix}-`) : `${prefix}-${bookingFormNo}`;
}

export async function loadSaleDeal(saleId: string, today: string) {
  const supabase = await createClient();
  const { data: sale } = await supabase
    .from("sales")
    .select(
      `*, units(unit_no, street, size_value, size_unit, width_ft, depth_ft, area_sqft, is_corner, blocks(name)),
       sale_buyers(share_pct, is_primary, clients(full_name, relation_type, guardian_name, cnic, passport_no,
         nationality, phone, email, address, city, country))`,
    )
    .eq("id", saleId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!sale || !sale.units) return null;

  const [{ data: installments }, { data: payments }, { data: possession }] = await Promise.all([
    supabase.from("installments").select("*").eq("sale_id", saleId).is("deleted_at", null).order("seq"),
    supabase
      .from("payments")
      .select("received_on, mode, instrument_no, status, instrument_status, payment_allocations(installment_id)")
      .eq("sale_id", saleId)
      .order("received_on"),
    supabase
      .from("possessions")
      .select("handover_date, dues_cleared_date")
      .eq("sale_id", saleId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  const rows = installments ?? [];
  // money only counts once it is valid and its instrument has cleared
  const cleared = (payments ?? []).filter(
    (p) => p.status === "valid" && (p.instrument_status === "not_applicable" || p.instrument_status === "cleared"),
  );
  const price = new Decimal(sale.final_price ?? 0);
  const amountPaid = rows.reduce((n, i) => n.plus(i.amount_paid), new Decimal(0));
  const outstanding = rows.reduce(
    (n, i) => n.plus(i.amount_due).plus(i.late_fee).minus(i.amount_paid).minus(i.waived_amount).minus(i.late_fee_paid),
    new Decimal(0),
  );

  const paidOn = new Map<string, string>();
  for (const p of cleared) for (const a of p.payment_allocations ?? []) paidOn.set(a.installment_id, p.received_on);

  const schedule: ScheduleRow[] = rows.map((i, n) => ({
    no: n + 1,
    label: i.label,
    dueDate: i.due_date,
    pct: price.isZero() ? null : new Decimal(i.amount_due).div(price).times(100).toDecimalPlaces(2).toString(),
    amount: new Decimal(i.amount_due).toFixed(2),
    paidDate: i.status === "paid" ? (paidOn.get(i.id) ?? null) : null,
  }));

  const buyers = (sale.sale_buyers ?? []).filter((b) => b.clients);
  const primary = buyers.find((b) => b.is_primary) ?? buyers[0];
  if (!primary) return null;
  const unit = sale.units;
  const first = cleared[0] ?? null;
  const last = cleared[cleared.length - 1] ?? null;

  const deal: Pick<DocContext, "date" | "specimen" | "plot" | "applicant" | "jointApplicants" | "sale" | "schedule"> = {
    date: today,
    specimen: false,
    plot: {
      no: unit.unit_no,
      block: unit.blocks?.name ?? null,
      street: unit.street,
      category: unit.is_corner ? "Corner" : "Standard",
      sizeLabel: formatSize(unit.size_value, unit.size_unit, unit.area_sqft, unit),
      areaSqft: String(unit.area_sqft),
    },
    applicant: party(primary.clients as Client),
    jointApplicants: buyers.filter((b) => b !== primary).map((b) => party(b.clients as Client)),
    sale: {
      bookingRef: sale.booking_form_no,
      bookingDate: sale.booking_date,
      agreementRef: documentRef(sale.booking_form_no, "SA"),
      agreementDate: sale.booking_date,
      allotmentRef: documentRef(sale.booking_form_no, "AL"),
      allotmentDate: sale.booking_date,
      totalPrice: price.toFixed(2),
      bookingAmount: sale.booking_amount === null ? null : new Decimal(sale.booking_amount).toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      lastPaymentDate: last?.received_on ?? null,
      planType: sale.plan_kind,
      downPaymentPct: sale.down_payment_pct === null ? null : String(Number(sale.down_payment_pct)),
      installmentCount: rows.filter((i) => i.type === "installment").length || null,
      frequencyLabel: sale.frequency ? sale.frequency.replace("_", "-") : null,
      paymentMode: first ? paymentModeLabel(first.mode) : null,
      instrumentNo: first?.instrument_no ?? null,
      duesClearedDate: possession?.dues_cleared_date ?? (outstanding.lte(0) ? (last?.received_on ?? null) : null),
      possessionDate: possession?.handover_date ?? null,
    },
    schedule,
  };

  return {
    projectId: sale.project_id,
    status: sale.status,
    bookingFormNo: sale.booking_form_no,
    outstanding,
    hasPossession: Boolean(possession),
    deal,
  };
}
