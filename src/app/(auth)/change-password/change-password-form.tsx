"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { resetSchema } from "@/features/auth/schemas";
import { changeOwnPassword } from "@/features/users/actions";

export function ChangePasswordForm({ name, username }: { name: string; username: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await changeOwnPassword(values.password);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.replace("/dashboard");
      router.refresh();
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose your password</CardTitle>
        <CardDescription>
          Welcome, {name}. You&apos;re signed in with the password your administrator gave you
          {username ? ` for "${username}"` : ""}. Pick your own before carrying on — nobody else will know it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                autoFocus
                aria-invalid={!!errors.password}
                {...form.register("password")}
              />
              <FieldDescription>At least 10 characters, with a letter and a number.</FieldDescription>
              <FieldError errors={[errors.password]} />
            </Field>
            <Field data-invalid={!!errors.confirm}>
              <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.confirm}
                {...form.register("confirm")}
              />
              <FieldError errors={[errors.confirm]} />
            </Field>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Saving…" : "Save and continue"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
