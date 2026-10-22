import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  inactive: "Your account has been deactivated. Contact the administrator.",
  link: "That link is invalid or has expired. Request a new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use the email and password provided by your administrator.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && ERRORS[error] && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {ERRORS[error]}
          </p>
        )}
        <LoginForm next={next} />
      </CardContent>
    </Card>
  );
}
