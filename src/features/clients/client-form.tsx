"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { applyServerErrors, CheckboxField, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { normalizeCnic } from "@/lib/cnic";
import { checkClientExists, createClientRecord, updateClientRecord } from "./actions";
import { clientFormSchema, type ClientFormParsed, type ClientFormValues } from "./schemas";

const EMPTY: ClientFormValues = {
  full_name: "",
  relation_type: "s/o",
  guardian_name: "",
  cnic: "",
  passport_no: "",
  nationality: "Pakistani",
  is_overseas: false,
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  country: "Pakistan",
  nok_name: "",
  nok_cnic: "",
  nok_relation: "",
  nok_phone: "",
  notes: "",
};

export function ClientForm({ clientId, initial }: { clientId?: string; initial?: Partial<ClientFormValues> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [duplicate, setDuplicate] = useState(false);
  const form = useForm<ClientFormValues, unknown, ClientFormParsed>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: { ...EMPTY, ...initial },
  });
  const { control } = form;
  const isOverseas = useWatch({ control, name: "is_overseas" });

  // Format CNIC as the user leaves the field and warn early about duplicates.
  const onCnicBlur = async () => {
    const raw = form.getValues("cnic");
    const cnic = raw ? normalizeCnic(raw) : null;
    if (cnic && cnic !== raw) form.setValue("cnic", cnic);
    if (!clientId && cnic) setDuplicate(await checkClientExists(cnic, ""));
    else setDuplicate(false);
  };

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = clientId ? await updateClientRecord(clientId, values) : await createClientRecord(values);
      if (!res.ok) {
        applyServerErrors(form.setError, res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      const id = clientId ?? (res.data as { id: string } | undefined)?.id;
      router.push(id ? `/clients/${id}` : "/clients");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>As printed on the CNIC / passport. Used on booking forms, receipts and letters.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField control={control} name="full_name" label="Full name" className="sm:col-span-2" autoComplete="off" />
          <SelectField
            control={control}
            name="relation_type"
            label="Relation"
            options={[
              { value: "s/o", label: "Son of (S/O)" },
              { value: "d/o", label: "Daughter of (D/O)" },
              { value: "w/o", label: "Wife of (W/O)" },
            ]}
          />
          <TextField control={control} name="guardian_name" label="Father / husband name" />
          <div onBlur={onCnicBlur}>
            <TextField
              control={control}
              name="cnic"
              label="CNIC"
              placeholder="12345-1234567-1"
              inputMode="numeric"
              description={
                duplicate ? (
                  <span className="text-amber-600 dark:text-amber-400">A client with this CNIC already exists — search for them instead.</span>
                ) : undefined
              }
            />
          </div>
          <TextField control={control} name="passport_no" label="Passport no." description={isOverseas ? "Required for overseas clients without CNIC/NICOP" : "Optional"} />
          <TextField control={control} name="nationality" label="Nationality" />
          <CheckboxField control={control} name="is_overseas" label="Overseas Pakistani / lives abroad" className="self-end pb-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField control={control} name="phone" label="Phone" type="tel" placeholder="+92 300 1234567" />
          <TextField control={control} name="whatsapp" label="WhatsApp" type="tel" placeholder="Same as phone if blank" />
          <TextField control={control} name="email" label="Email" type="email" className="sm:col-span-2" />
          <TextField control={control} name="address" label="Address" className="sm:col-span-2" />
          <TextField control={control} name="city" label="City" />
          <TextField control={control} name="country" label="Country" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next of kin</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField control={control} name="nok_name" label="Name" />
          <TextField control={control} name="nok_relation" label="Relation" placeholder="Wife, son, brother…" />
          <TextField control={control} name="nok_cnic" label="CNIC" placeholder="12345-1234567-1" inputMode="numeric" />
          <TextField control={control} name="nok_phone" label="Phone" type="tel" />
          <TextareaField control={control} name="notes" label="Notes" rows={2} className="sm:col-span-2 lg:col-span-4" />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : clientId ? "Save changes" : "Add client"}
        </Button>
      </div>
    </form>
  );
}
