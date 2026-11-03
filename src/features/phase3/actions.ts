"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { cancellationSchema, possessionSchema, refundSchema, transferSchema } from "./schemas";

const fieldErrors = (e: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) =>
  e.flatten().fieldErrors as Record<string, string[]>;

/** Possession, transfer and cancellation are all Manager decisions. */
async function assertManager() {
  const user = await getCurrentUser();
  return hasRole(user, "super_admin", "manager");
}

export async function grantPossession(input: unknown): Promise<ActionResult<{ letterNo: string }>> {
  if (!(await assertManager())) return { ok: false, error: "Only a Manager can hand over possession." };
  const parsed = possessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("grant_possession", {
    p: {
      sale_id: v.sale_id,
      handover_date: v.handover_date,
      dues_cleared_date: v.dues_cleared_date || null,
      notes: v.notes || null,
    } as never,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const row = data as unknown as { letter_no: string };
  revalidatePath(`/sales/${v.sale_id}`);
  revalidatePath("/sales");
  return { ok: true, data: { letterNo: row.letter_no }, message: `Possession handed over. Letter ${row.letter_no}.` };
}

export async function transferSale(input: unknown): Promise<ActionResult<{ transferNo: string }>> {
  if (!(await assertManager())) return { ok: false, error: "Only a Manager can approve a transfer." };
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transfer_sale", {
    p: {
      sale_id: v.sale_id,
      transfer_date: v.transfer_date,
      transfer_fee: v.transfer_fee || "0",
      reason: v.reason,
      notes: v.notes || null,
      buyers: v.buyers.map((b) => ({ client_id: b.client_id, share_pct: b.share_pct, is_primary: b.is_primary })),
    } as never,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const row = data as unknown as { transfer_no: string };
  revalidatePath(`/sales/${v.sale_id}`);
  revalidatePath("/sales");
  return { ok: true, data: { transferNo: row.transfer_no }, message: `Transferred. Ref ${row.transfer_no}.` };
}

export async function cancelSale(input: unknown): Promise<ActionResult<{ cancellationNo: string; refundDue: string }>> {
  if (!(await assertManager())) return { ok: false, error: "Only a Manager can cancel a booking." };
  const parsed = cancellationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_sale", {
    p: {
      sale_id: v.sale_id,
      cancelled_on: v.cancelled_on,
      deduction_pct: v.deduction_pct,
      reason: v.reason,
    } as never,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const row = data as unknown as { cancellation_no: string; refund_due: string };
  revalidatePath(`/sales/${v.sale_id}`);
  revalidatePath("/sales");
  revalidatePath("/refunds");
  return {
    ok: true,
    data: { cancellationNo: row.cancellation_no, refundDue: row.refund_due },
    message: `Cancelled. ${row.cancellation_no}.`,
  };
}

export async function settleRefund(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin", "manager", "accounts")) {
    return { ok: false, error: "Only Accounts and Managers can pay a refund." };
  }
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_refund", {
    p_cancellation: v.cancellation_id,
    p_paid_on: v.paid_on,
    p_reference: v.reference || null,
    p_reason: v.reason,
  } as never);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath("/refunds");
  return { ok: true, message: "Refund recorded." };
}
