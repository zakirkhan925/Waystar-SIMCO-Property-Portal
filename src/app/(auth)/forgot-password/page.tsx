"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { requestPasswordReset } from "@/features/auth/actions";
import { forgotSchema } from "@/features/auth/schemas";

export default function ForgotPasswordPage() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<string | null>(null);
  const form = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await requestPasswordReset(values);
      setSent(res.ok ? (res.message ?? "Check your email.") : res.error);
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>We&apos;ll email you a link to choose a new password.</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm">{sent}</p>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" autoComplete="email" autoFocus aria-invalid={!!errors.email} {...form.register("email")} />
                <FieldError errors={[errors.email]} />
              </Field>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Sending…" : "Send reset link"}
              </Button>
              <Link href="/login" className="text-center text-sm text-muted-foreground hover:underline">
                Back to sign in
              </Link>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
