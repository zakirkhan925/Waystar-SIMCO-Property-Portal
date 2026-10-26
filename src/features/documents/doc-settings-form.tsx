"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { applyServerErrors, TextField } from "@/components/forms/fields";
import { saveDocSettings } from "./actions";
import { docSettingsSchema, type DocSettingsParsed, type DocSettingsValues } from "./schemas";

export function DocSettingsForm({ projectId, initial }: { projectId: string; initial: DocSettingsValues }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<DocSettingsValues, unknown, DocSettingsParsed>({ resolver: zodResolver(docSettingsSchema), defaultValues: initial });
  const { control } = form;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await saveDocSettings(projectId, values);
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
          <CardTitle>Letter & agreement details</CardTitle>
          <CardDescription>
            These fill the blanks in the documents. Anything left empty prints as a blank line to complete by hand.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField control={control} name="display_name" label="Project name on documents" placeholder="SIMCO VILLAS" />
          <TextField control={control} name="full_address" label="Project address" placeholder="PMO Road, Taxila, District Rawalpindi" />
          <TextField control={control} name="seller_legal_name" label="Seller legal name" />
          <TextField control={control} name="seller_legal_status" label="Legal status / registration no. / NTN" />
          <TextField control={control} name="seller_ntn" label="Seller NTN" />
          <TextField control={control} name="seller_office_address" label="Seller registered office" />
          <TextField control={control} name="seller_account_title" label="Payee account title (cheques / transfers)" />
          <TextField control={control} name="execution_city" label="City where agreements are signed" />
          <TextField control={control} name="signatory_name" label="Authorized signatory" />
          <TextField control={control} name="signatory_cnic" label="Signatory CNIC" placeholder="12345-1234567-1" />
          <TextField control={control} name="managing_director_name" label="Managing Director (Allotment Letter)" />
          <TextField control={control} name="approval_noc_ref" label="Approval / NOC ref." />
          <TextField control={control} name="possession_timeline" label="Possession date / timeline" placeholder="e.g. 31-Dec-2028" />
          <TextField control={control} name="delay_compensation_basis" label="Compensation for delayed possession" />
          <TextField control={control} name="marketed_by" label="Marketed by" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Time limits (days)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <TextField control={control} name="refund_days_after_resale" label="Refund after re-sale" inputMode="numeric" />
          <TextField control={control} name="discrepancy_report_days" label="Report plot discrepancy" inputMode="numeric" />
          <TextField control={control} name="allotment_countersign_days" label="Countersign allotment" inputMode="numeric" />
          <TextField control={control} name="ndc_validity_days" label="NDC valid for" inputMode="numeric" />
          <TextField control={control} name="dispute_window_days" label="Raise disputes within" inputMode="numeric" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Letterhead margins (mm)</CardTitle>
          <CardDescription>
            Where text may print on the letterhead, measured from the paper edge. Body text starts below the tagline on every
            page; on page 1 the heading (title, ref no., addressee) sits higher, beside the tagline. Leave the heading position
            blank to start the heading with the body.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <TextField control={control} name="letterhead_top_mm" label="Body starts at" inputMode="decimal" />
          <TextField control={control} name="letterhead_bottom_mm" label="Keep clear at bottom" inputMode="decimal" />
          <TextField control={control} name="letterhead_left_mm" label="Left margin" inputMode="decimal" />
          <TextField control={control} name="letterhead_right_mm" label="Right margin" inputMode="decimal" />
          <TextField control={control} name="letterhead_head_top_mm" label="Page-1 heading from top" inputMode="decimal" />
          <TextField control={control} name="letterhead_head_left_mm" label="Page-1 heading from left" inputMode="decimal" />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </Button>
      </div>
    </form>
  );
}
