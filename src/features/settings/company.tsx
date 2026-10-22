"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { applyServerErrors, TextField } from "@/components/forms/fields";
import { updateCompanySettings } from "./actions";
import { companySchema, type CompanyParsed, type CompanyValues } from "./schemas";

export function CompanyForm({ initial }: { initial: CompanyValues }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<CompanyValues, unknown, CompanyParsed>({ resolver: zodResolver(companySchema), defaultValues: initial });
  const { control } = form;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await updateCompanySettings(values);
      if (!res.ok) {
        applyServerErrors(form.setError, res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>Printed on receipts, letters and statements.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField control={control} name="company_name" label="Company name" />
          <TextField control={control} name="partner_name" label="Developer / partner" />
          <TextField control={control} name="address" label="Address" className="sm:col-span-2" />
          <TextField control={control} name="phone" label="Phone" />
          <TextField control={control} name="email" label="Email" type="email" />
          <TextField control={control} name="website" label="Website" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>Pre-filled on new sales and leases; can be changed per deal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField control={control} name="default_sale_commission_pct" label="Sale commission %" inputMode="decimal" />
          <TextField control={control} name="default_lease_commission_pct" label="Lease commission %" inputMode="decimal" />
          <TextField control={control} name="default_rent_increment_pct" label="Annual rent increment %" inputMode="decimal" />
          <TextField
            control={control}
            name="discount_approval_threshold_pct"
            label="Discount needing approval %"
            inputMode="decimal"
            description="0 = every discount needs a Manager"
          />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
