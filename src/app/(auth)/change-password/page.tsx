import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Choose a password" };

/**
 * Where someone lands on their first sign-in, after an admin handed them a username and a
 * temporary password. It sits in the (auth) group so the portal layout's guard cannot loop
 * against it.
 */
export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  // Nothing to do here once they have chosen their own.
  if (!user.mustChangePassword) redirect("/dashboard");

  return <ChangePasswordForm name={user.fullName} username={user.username} />;
}
