"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { bookingSchema, paymentSchema, reasonSchema } from "./schemas";

const fieldErrors = (e: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) =>
  e.flatten().fieldErrors as Record<string, string[]>;

export async function createBooking(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin", "manager", "sales_agent")) {
    return { ok: false, error: "You don't have permission to book units." };
  }
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_sale", {
    p: {
      unit_id: v.unit_id,
      booking_date: v.booking_date,
      list_price: v.list_price,
      discount: v.discount || "0",
      plan_kind: v.plan_kind,
      payment_plan_id: v.payment_plan_id || null,
      down_payment_pct: v.down_payment_pct,
      installment_pct: v.installment_pct,
      possession_pct: v.possession_pct,
      tenure_months: v.plan_kind === "installment" ? v.tenure_months : null,
      frequency: v.plan_kind === "installment" ? v.frequency : null,
      booking_amount: v.booking_amount || null,
      first_installment_date: v.first_installment_date || null,
      dealer_id: v.dealer_id || null,
      commission_pct: v.commission_pct,
      notes: v.notes || null,
      buyers: v.buyers.map((b) => ({ client_id: b.client_id, share_pct: b.share_pct, is_primary: b.is_primary })),
    } as never,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const sale = data as unknown as { id: string; booking_form_no: string };
  revalidatePath("/sales");
  revalidatePath(`/units/${v.unit_id}`);
  return { ok: true, data: { id: sale.id }, message: `Booked. Form no. ${sale.booking_form_no}.` };
}

export async function recordPayment(input: unknown): Promise<ActionResult<{ id: string; receiptNo: string }>> {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin", "manager", "accounts")) {
    return { ok: false, error: "Only Accounts and Managers can record payments." };
  }
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const needsInstrument = v.mode !== "cash" && v.mode !== "online";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_payment", {
    p: {
      sale_id: v.sale_id,
      received_on: v.received_on,
      amount: v.amount,
      mode: v.mode,
      bank_name: v.bank_name || null,
      instrument_no: v.instrument_no || null,
      instrument_date: v.instrument_date || v.received_on,
      // cash and online clear instantly; an instrument stays pending until the bank clears it
      instrument_status: needsInstrument ? (v.already_cleared ? "cleared" : "pending") : null,
      cleared_on: needsInstrument && v.already_cleared ? v.received_on : null,
      payer_client_id: v.payer_client_id || null,
      notes: v.notes || null,
    } as never,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const payment = data as unknown as { id: string; receipt_no: string };
  revalidatePath(`/sales/${v.sale_id}`);
  revalidatePath("/payments");
  revalidatePath("/recoveries");
  return { ok: true, data: { id: payment.id, receiptNo: payment.receipt_no }, message: `Receipt ${payment.receipt_no} recorded.` };
}

async function paymentAction(
  rpc: "clear_instrument" | "bounce_instrument" | "reverse_payment",
  args: Record<string, unknown>,
  saleId: string,
  message: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin", "manager", "accounts")) {
    return { ok: false, error: "Only Accounts and Managers can do this." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, args as never);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/sales/${saleId}`);
  revalidatePath("/payments");
  revalidatePath("/recoveries");
  return { ok: true, message };
}

export async function clearInstrument(paymentId: string, saleId: string, clearedOn: string): Promise<ActionResult> {
  return paymentAction("clear_instrument", { p_payment: paymentId, p_cleared_on: clearedOn || null }, saleId, "Marked as cleared.");
}

export async function bounceInstrument(paymentId: string, saleId: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: "Give the reason it bounced." };
  return paymentAction("bounce_instrument", { p_payment: paymentId, p_reason: parsed.data.reason }, saleId, "Marked as bounced.");
}

export async function reversePayment(paymentId: string, saleId: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: "Give the reason for reversing it." };
  return paymentAction("reverse_payment", { p_payment: paymentId, p_reason: parsed.data.reason }, saleId, "Receipt reversed.");
}

export async function reallocatePayment(
  paymentId: string,
  saleId: string,
  allocations: { installment_id: string; amount: string }[],
  reason: string,
): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: "Give the reason for allocating it by hand." };
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin", "manager", "accounts")) {
    return { ok: false, error: "Only Accounts and Managers can do this." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_payment_allocations", {
    p_payment: paymentId,
    p_alloc: allocations as never,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/sales/${saleId}`);
  return { ok: true, message: "Allocation updated." };
}

/** Rebuild a schedule (Managers only, and only while nothing has been paid against it). */
export async function regenerateSchedule(saleId: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: "Give the reason for rebuilding the schedule." };
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin", "manager")) return { ok: false, error: "Only Managers can rebuild a schedule." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_installment_schedule", { p_sale: saleId, p_reason: parsed.data.reason });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/sales/${saleId}`);
  return { ok: true, message: "Schedule rebuilt." };
}

/** Search clients for the booking wizard (agents see only their own — RLS decides). */
export async function searchClients(term: string) {
  const supabase = await createClient();
  const q = term.replace(/[%_,()]/g, " ").trim();
  let query = supabase.from("clients").select("id, full_name, cnic, passport_no, phone").is("deleted_at", null);
  if (q) {
    const digits = q.replace(/\D/g, "").replace(/^0+/, "");
    const ors = [`full_name.ilike.%${q}%`];
    if (digits.length >= 4) ors.push(`search_digits.ilike.%${digits}%`);
    query = query.or(ors.join(","));
  }
  const { data } = await query.order("full_name").limit(10);
  return data ?? [];
}
