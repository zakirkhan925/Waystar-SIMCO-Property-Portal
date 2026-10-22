"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { CLIENT_DOC_KINDS, clientFormSchema, type ClientDocKind, type ClientFormParsed } from "./schemas";

function toRow(v: ClientFormParsed) {
  const n = (s: string) => (s === "" ? null : s);
  return {
    full_name: v.full_name,
    relation_type: n(v.relation_type),
    guardian_name: n(v.guardian_name),
    cnic: n(v.cnic),
    passport_no: n(v.passport_no),
    nationality: v.nationality,
    is_overseas: v.is_overseas,
    phone: v.phone,
    whatsapp: n(v.whatsapp),
    email: n(v.email.toLowerCase()),
    address: n(v.address),
    city: n(v.city),
    country: v.country,
    nok_name: n(v.nok_name),
    nok_cnic: n(v.nok_cnic),
    nok_relation: n(v.nok_relation),
    nok_phone: n(v.nok_phone),
    notes: n(v.notes),
  };
}

export async function createClientRecord(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin", "manager", "sales_agent")) return { ok: false, error: "You can't add clients." };

  const parsed = clientFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").insert(toRow(parsed.data)).select("id").single();
  if (error) {
    const msg = dbErrorMessage(error);
    const field = error.code === "23505" ? (error.message.includes("passport") ? "passport_no" : "cnic") : undefined;
    return { ok: false, error: msg, fieldErrors: field ? { [field]: [msg] } : undefined };
  }
  revalidatePath("/clients");
  return { ok: true, data: { id: data.id }, message: "Client added." };
}

export async function updateClientRecord(id: string, input: unknown): Promise<ActionResult> {
  const parsed = clientFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").update(toRow(parsed.data)).eq("id", id).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "You don't have permission to edit this client." };
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  return { ok: true, message: "Client updated." };
}

/** Is there already a client with this CNIC / passport? (works across agents without exposing records) */
export async function checkClientExists(cnic: string, passport: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("client_exists", {
    p_cnic: cnic || undefined,
    p_passport: passport || undefined,
  });
  return Boolean(data);
}

/** After the browser uploads a file to storage, link it to the client record. */
export async function setClientDocument(clientId: string, kind: ClientDocKind, path: string): Promise<ActionResult> {
  if (!CLIENT_DOC_KINDS.includes(kind)) return { ok: false, error: "Unknown document type." };
  if (!path.startsWith(`clients/${clientId}/`)) return { ok: false, error: "Invalid file path." };

  const patch =
    kind === "photo" ? { photo_path: path } : kind === "cnic_front" ? { cnic_front_path: path } : { cnic_back_path: path };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", clientId)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data?.length) return { ok: false, error: "You don't have permission to update this client." };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, message: "Document uploaded." };
}

export async function deleteClient(clientId: string, reason: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin")) return { ok: false, error: "Only a Super Admin can delete clients." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete", { p_table: "clients", p_id: clientId, p_reason: reason });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/clients");
  return { ok: true, message: "Client deleted." };
}
