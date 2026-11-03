"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { applyServerErrors, CheckboxField, SelectField, TextField } from "@/components/forms/fields";
import { ROLE_LABELS } from "@/lib/labels";
import { createUser, setTemporaryPassword, updateUser } from "./actions";
import {
  createUserSchema,
  ROLE_DESCRIPTIONS,
  STAFF_ROLES,
  userFormSchema,
  type CreateUserParsed,
  type CreateUserValues,
  type UserFormValues,
} from "./schemas";

type Project = { id: string; name: string; code: string };

export function UserDialog({
  projects,
  user,
  trigger,
}: {
  projects: Project[];
  user?: { id: string } & UserFormValues;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Creating an account also sets its first password; editing one never touches it.
  const form = useForm<CreateUserValues, unknown, CreateUserParsed>({
    resolver: zodResolver(user ? (userFormSchema as unknown as typeof createUserSchema) : createUserSchema),
    defaultValues: user
      ? { ...user, password: "" }
      : { full_name: "", username: "", email: "", phone: "", role: "sales_agent", is_active: true, project_ids: [], password: "" },
  });
  const { control } = form;
  const role = useWatch({ control, name: "role" });
  const allProjects = role === "super_admin" || role === "manager";

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = user ? await updateUser(user.id, values) : await createUser(values);
      if (!res.ok) {
        applyServerErrors(form.setError, res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      if (!user) form.reset();
      router.refresh();
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? `Edit ${user.full_name}` : "Add user"}</DialogTitle>
          <DialogDescription>
            {user
              ? "Change role, project access or deactivate."
              : "They sign in with this username and password. No email is involved — give them the details yourself. They must change the password at first sign-in."}
          </DialogDescription>
        </DialogHeader>
        <form id="user-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <TextField control={control} name="full_name" label="Full name" className="sm:col-span-2" />
          <TextField
            control={control}
            name="username"
            label="Username"
            autoComplete="off"
            description={user ? undefined : "What they type to sign in, e.g. mobeen"}
          />
          {!user && (
            <TextField
              control={control}
              name="password"
              label="Temporary password"
              type="text"
              autoComplete="new-password"
              description="Give this to them directly. They must change it at first sign-in."
            />
          )}
          <TextField control={control} name="email" label="Email (optional)" type="email" description="Contact only — not used to sign in" />
          <TextField control={control} name="phone" label="Phone" type="tel" />
          <SelectField
            control={control}
            name="role"
            label="Role"
            className="sm:col-span-2"
            options={STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            description={ROLE_DESCRIPTIONS[role]}
          />
          <Field className="sm:col-span-2">
            <FieldLabel>Project access</FieldLabel>
            {allProjects ? (
              <FieldDescription>{ROLE_LABELS[role]}s can see every project.</FieldDescription>
            ) : (
              <Controller
                control={control}
                name="project_ids"
                render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {projects.map((p) => {
                      const checked = field.value.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) =>
                              field.onChange(c === true ? [...field.value, p.id] : field.value.filter((x) => x !== p.id))
                            }
                          />
                          {p.name}
                        </label>
                      );
                    })}
                  </div>
                )}
              />
            )}
          </Field>
          {user && <CheckboxField control={control} name="is_active" label="Active (can sign in)" className="sm:col-span-2" />}
        </form>
        <DialogFooter className="sm:justify-between">
          {user ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                // No email to send a link to, so a Super Admin issues a new one by hand.
                const next = window.prompt(
                  `New temporary password for ${user.full_name}.
At least 8 characters with a letter and a number. They must change it at next sign-in.`,
                );
                if (!next) return;
                startTransition(async () => {
                  const res = await setTemporaryPassword({ user_id: user.id, password: next });
                  if (res.ok) toast.success(res.message);
                  else toast.error(res.error);
                });
              }}
            >
              Set new password
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" form="user-form" disabled={pending}>
            {pending ? "Saving…" : user ? "Save" : "Add user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
