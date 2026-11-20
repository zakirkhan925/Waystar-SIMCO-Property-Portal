"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function revokeDocument(token: string, reason: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!hasRole(user, "super_admin")) return { ok: false, error: "Only a Super Admin can revoke a document." };
  if (typeof reason !== "string" || !reason.trim()) return { ok: false, error: "Enter a reason for revoking the document." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_document", { p_token: token, p_reason: reason.trim() });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath("/settings/issued-documents");
  revalidatePath(`/verify/${token}`);
  return { ok: true, message: "Document revoked." };
}
