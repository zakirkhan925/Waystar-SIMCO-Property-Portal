"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { applyServerErrors, CheckboxField, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS } from "@/lib/labels";
import { createProject, updateProject } from "./actions";
import { LATE_FEE_LABELS, projectFormSchema, type ProjectFormParsed, type ProjectFormValues } from "./schemas";

const DEFAULTS: ProjectFormValues = {
  name: "",
  code: "",
  type: "high_rise",
  status: "under_construction",
  location: "",
  description: "",
  sqft_per_marla: "225",
  marla_per_kanal: "20",
  late_fee_method: "none",
  late_fee_rate: "0",
  late_fee_grace_days: "0",
  late_fee_cap_pct: "",
  corner_premium_pct: "0",
  cancel_after_consecutive_missed: "",
  cancellation_deduction_pct: "",
  construction_min_paid_pct: "",
  full_payment_possession_charge_pct: "0",
  down_payment_balance_days: "",
  sort_order: "0",
  is_active: true,
};

export function ProjectForm({ projectId, initial }: { projectId?: string; initial?: Partial<ProjectFormValues> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ProjectFormValues, unknown, ProjectFormParsed>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { ...DEFAULTS, ...initial },
  });
  const { control } = form;
  const lateFee = useWatch({ control, name: "late_fee_method" });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = projectId ? await updateProject(projectId, values) : await createProject(values);
      if (!res.ok) {
        applyServerErrors(form.setError, res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      const id = projectId ?? (res.data as { id: string } | undefined)?.id;
      if (!projectId && id) router.push(`/settings/projects/${id}`);
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField control={control} name="name" label="Name" className="sm:col-span-2" />
          <TextField control={control} name="code" label="Code" description="Used in receipt & letter numbers" />
          <TextField control={control} name="sort_order" label="Display order" inputMode="numeric" />
          <SelectField
            control={control}
            name="type"
            label="Type"
            className="sm:col-span-2"
            options={Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            disabled={!!projectId}
            description={projectId ? "Can't be changed after creation" : undefined}
          />
          <SelectField
            control={control}
            name="status"
            label="Status"
            options={Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <TextField control={control} name="location" label="Location" />
          <TextareaField control={control} name="description" label="Description" rows={2} className="sm:col-span-2 lg:col-span-4" />
          <CheckboxField control={control} name="is_active" label="Active (shown in inventory and booking)" className="sm:col-span-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Area & late-payment penalty</CardTitle>
          <CardDescription>
            Penalty settings are applied to overdue installments by the nightly job (Phase 5). The exact SIMCO policy is still to
            be confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField control={control} name="sqft_per_marla" label="Sq ft per marla" inputMode="decimal" />
          <TextField control={control} name="marla_per_kanal" label="Marla per kanal" inputMode="decimal" />
          <SelectField
            control={control}
            name="late_fee_method"
            label="Late penalty"
            className="sm:col-span-2"
            options={Object.entries(LATE_FEE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          {lateFee !== "none" && (
            <>
              <TextField
                control={control}
                name="late_fee_rate"
                label={lateFee === "flat_per_installment" ? "Amount (Rs)" : "Rate (%)"}
                inputMode="decimal"
              />
              <TextField control={control} name="late_fee_grace_days" label="Grace days" inputMode="numeric" />
              <TextField
                control={control}
                name="late_fee_cap_pct"
                label="Cap (% of installment)"
                inputMode="decimal"
                description="Optional maximum penalty"
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales policy</CardTitle>
          <CardDescription>
            Used by bookings, schedules and recoveries. Missed installments only flag a sale as &ldquo;cancellation due&rdquo;; a
            Manager confirms every cancellation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField control={control} name="corner_premium_pct" label="Corner plot premium %" inputMode="decimal" />
          <TextField
            control={control}
            name="full_payment_possession_charge_pct"
            label="Possession charges on full payment %"
            inputMode="decimal"
          />
          <TextField
            control={control}
            name="down_payment_balance_days"
            label="Rest of down payment due within (days)"
            inputMode="numeric"
            description="After the booking amount. Blank = not decided"
          />
          <TextField
            control={control}
            name="cancel_after_consecutive_missed"
            label="Flag for cancellation after N missed installments"
            inputMode="numeric"
            description="Blank = never flag"
          />
          <TextField control={control} name="cancellation_deduction_pct" label="Cancellation deduction % of price" inputMode="decimal" />
          <TextField control={control} name="construction_min_paid_pct" label="Construction allowed after % paid" inputMode="decimal" />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : projectId ? "Save project" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
