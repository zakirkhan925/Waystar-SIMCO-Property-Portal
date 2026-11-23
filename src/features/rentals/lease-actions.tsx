"use client";

import { addDays, format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { todayPK } from "@/lib/dates";
import { changeLease } from "./actions";
import { paymentModeField, RentalField, termFields, type Field } from "./lease-fields";
import type { Lease } from "./queries";
import type { LeaseIntent } from "./schemas";

const amount: Field = { name: "amount", label: "Amount (PKR)", type: "money" };
const reason: Field = { name: "reason", label: "Reason", type: "textarea" };
const reference: Field = { name: "reference_no", label: "Reference" };

function actionFields(intent: LeaseIntent, lease?: Lease): Field[] {
  const today = todayPK();
  switch (intent) {
    case "payment":
      return [
        amount, paymentModeField, { name: "received_on", label: "Received on", type: "date", value: today, max: today },
        { name: "bank_name", label: "Bank", required: false },
        { name: "instrument_no", label: "Instrument no.", required: false },
        { name: "instrument_date", label: "Instrument date", type: "date", required: false },
        { name: "notes", label: "Notes", type: "textarea", required: false },
      ];
    case "deposit":
      return [
        { name: "type", label: "Entry type", options: [
          { value: "received", label: "Received" }, { value: "adjusted", label: "Adjusted (positive or negative)" },
          { value: "refunded", label: "Refunded" },
        ] },
        amount, { name: "txn_date", label: "Entry date", type: "date", value: today },
        { ...reference, required: false }, reason,
      ];
    case "payout":
      return [amount, paymentModeField, { name: "paid_on", label: "Paid on", type: "date", value: today }, reference];
    case "terminate":
      return [{ name: "date", label: "Termination date", type: "date", value: today, max: today }, reason];
    case "clear":
      return [{ name: "date", label: "Cleared on", type: "date", value: today, max: today }];
    case "bounce":
    case "reverse":
    case "reversePayout":
      return [reason];
    case "penalty":
    case "waive":
      return [amount, reason];
    case "renew":
      return lease ? termFields({
        start_date: format(addDays(parseISO(lease.end_date), 1), "yyyy-MM-dd"),
        monthly_rent: String(lease.current_rent),
        security_deposit: String(lease.security_deposit),
        rent_due_day: String(lease.rent_due_day),
        increment_pct: String(lease.increment_pct),
        commission_pct: String(lease.commission_pct),
        notes: lease.notes ?? "",
      }) : [];
  }
}

export function LeaseAction({ leaseId, intent, title, target, description, lease }: {
  leaseId: string; intent: LeaseIntent; title: string; target?: string; description?: string; lease?: Lease;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    startTransition(async () => {
      const result = await changeLease(leaseId, { ...values, intent, target });
      if (!result.ok) { setError(result.error); return; }
      toast.success(result.message);
      setOpen(false);
      if (result.data?.id && result.data.id !== leaseId) router.push(`/rentals/${result.data.id}`);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setError(""); } }}>
      <DialogTrigger asChild><Button type="button" variant="outline" size="sm">{title}</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? "Enter the details for this lease."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {actionFields(intent, lease).map((field) => <RentalField key={field.name} field={field} />)}
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : title}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
