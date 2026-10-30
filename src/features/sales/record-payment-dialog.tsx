"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { applyServerErrors, CheckboxField, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { todayPK } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { recordPayment } from "./actions";
import { paymentSchema, PAYMENT_MODE_LABELS, type PaymentParsed, type PaymentValues } from "./schemas";

export function RecordPaymentDialog({
  saleId,
  buyers,
  suggestedAmount,
  trigger,
}: {
  saleId: string;
  buyers: { id: string; full_name: string }[];
  suggestedAmount?: string | null;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<PaymentValues, unknown, PaymentParsed>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      sale_id: saleId,
      received_on: todayPK(),
      amount: suggestedAmount ? Number(suggestedAmount).toFixed(2) : "",
      mode: "cash",
      bank_name: "",
      instrument_no: "",
      instrument_date: "",
      already_cleared: false,
      payer_client_id: buyers[0]?.id ?? "",
      notes: "",
    },
  });
  const { control } = form;
  const [mode, amount] = useWatch({ control, name: ["mode", "amount"] });
  const needsInstrument = mode !== "cash" && mode !== "online";
  const parsedAmount = Number(String(amount).replace(/,/g, "")) || 0;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await recordPayment(values);
      if (!res.ok) {
        applyServerErrors(form.setError, res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      form.reset({ ...form.getValues(), amount: "", instrument_no: "", notes: "" });
      router.refresh();
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus /> Record payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            It settles the oldest unpaid installment first. Cheques, pay orders and transfers only count once they clear.
          </DialogDescription>
        </DialogHeader>
        <form id="payment-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={control}
            name="amount"
            label="Amount (Rs)"
            inputMode="decimal"
            autoFocus
            description={parsedAmount > 0 ? formatPKR(parsedAmount) : undefined}
          />
          <TextField control={control} name="received_on" label="Received on" type="date" />
          <SelectField
            control={control}
            name="mode"
            label="Mode"
            options={Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <SelectField
            control={control}
            name="payer_client_id"
            label="Paid by"
            options={buyers.map((b) => ({ value: b.id, label: b.full_name }))}
          />
          {needsInstrument && (
            <>
              <TextField control={control} name="bank_name" label="Bank" placeholder="HBL" />
              <TextField control={control} name="instrument_no" label="Cheque / instrument no." />
              <TextField control={control} name="instrument_date" label="Instrument date" type="date" />
              <CheckboxField
                control={control}
                name="already_cleared"
                label="Already cleared the bank"
                className="self-end pb-2"
              />
            </>
          )}
          <TextareaField control={control} name="notes" label="Notes" rows={2} className="sm:col-span-2" />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" disabled={pending}>
            {pending ? "Saving…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
