"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { leaseChangeSchema, leaseSchema } from "./schemas";

function refreshRentals(leaseId: string, unitId?: string) {
  revalidatePath("/rentals");
  revalidatePath(`/rentals/${leaseId}`);
  revalidatePath("/clients/[clientId]", "page");
  revalidatePath("/reports");
  if (unitId) revalidatePath(`/units/${unitId}`);
}

export async function createLease(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!hasRole(await getCurrentUser(), "super_admin", "manager")) {
    return { ok: false, error: "Only Managers can create leases." };
  }
  const parsed = leaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_lease", { p: parsed.data });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  refreshRentals(data.id, data.unit_id);
  return { ok: true, data: { id: data.id }, message: "Lease created." };
}

export async function changeLease(leaseId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  const parsed = leaseChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!z.uuid().safeParse(leaseId).success) return { ok: false, error: "Invalid lease." };

  const v = parsed.data;
  const managerOnly = ["penalty", "waive", "terminate", "renew"].includes(v.intent);
  if (!hasRole(user, "super_admin", "manager") && (managerOnly || !hasRole(user, "accounts"))) {
    return { ok: false, error: "You do not have permission for this action." };
  }

  const supabase = await createClient();
  const { data: lease, error: readError } = await supabase.from("leases").select("id, unit_id").eq("id", leaseId).maybeSingle();
  if (readError || !lease) return { ok: false, error: "Lease unavailable." };

  const apply = async () => {
    switch (v.intent) {
      case "payment":
        return supabase.rpc("record_rent_payment", { p: { ...v, lease_id: leaseId } });
      case "clear":
        return supabase.rpc("clear_rent_instrument", { p_payment: v.target, p_cleared_on: v.date });
      case "bounce":
        return supabase.rpc("bounce_rent_instrument", { p_payment: v.target, p_reason: v.reason });
      case "reverse":
        return supabase.rpc("reverse_rent_payment", { p_payment: v.target, p_reason: v.reason });
      case "penalty":
        return supabase.rpc("add_rent_penalty", { p_invoice: v.target, p_amount: v.amount as unknown as number, p_reason: v.reason });
      case "waive":
        return supabase.rpc("waive_rent", { p_invoice: v.target, p_amount: v.amount as unknown as number, p_reason: v.reason });
      case "deposit":
        return supabase.rpc("record_deposit", { p: { ...v, lease_id: leaseId } });
      case "payout":
        return supabase.rpc("record_owner_payout", { p: { ...v, lease_id: leaseId } });
      case "reversePayout":
        return supabase.rpc("reverse_owner_payout", { p_payout: v.target, p_reason: v.reason });
      case "terminate":
        return supabase.rpc("terminate_lease", { p_lease: leaseId, p_date: v.date, p_reason: v.reason });
      case "renew": {
        const { data, error } = await supabase.rpc("renew_lease", { p: { ...v, lease_id: leaseId } });
        return { error, newLeaseId: data?.id };
      }
    }
  };

  const result = await apply();
  if (result.error) return { ok: false, error: dbErrorMessage(result.error) };
  const id = "newLeaseId" in result && result.newLeaseId ? result.newLeaseId : leaseId;
  refreshRentals(leaseId, lease.unit_id);
  return { ok: true, data: { id }, message: "Lease updated." };
}
