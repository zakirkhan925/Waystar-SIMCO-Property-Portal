"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftRight, KeyRound, Ban } from "lucide-react";
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
import { applyServerErrors, TextareaField, TextField } from "@/components/forms/fields";
import { BuyerPicker, type PickedBuyer } from "@/features/sales/buyer-picker";
import { todayPK } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { cancelSale, grantPossession, transferSale } from "./actions";
import {
  cancellationSchema,
  possessionSchema,
  transferSchema,
  type CancellationParsed,
  type CancellationValues,
  type PossessionParsed,
  type PossessionValues,
  type TransferParsed,
  type TransferValues,
} from "./schemas";

/* ------------------------------------------------------------------ possession */

export function PossessionDialog({ saleId, outstanding }: { saleId: string; outstanding: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const settled = outstanding <= 0;

  const form = useForm<PossessionValues, unknown, PossessionParsed>({
    resolver: zodResolver(possessionSchema),
    defaultValues: { sale_id: saleId, handover_date: todayPK(), dues_cleared_date: todayPK(), notes: "" },
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await grantPossession(values);
      if (!res.ok) {
        applyServerErrors(form.setError, res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!settled} title={settled ? undefined : "The account must be cleared first"}>
          <KeyRound /> Hand over possession
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hand over possession</DialogTitle>
          <DialogDescription>
            This issues the Possession Letter and closes the sale. The discrepancy window starts from the handover date.
          </DialogDescription>
        </DialogHeader>
        <form id="possession-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="handover_date" label="Handover date" type="date" />
          <TextField control={form.control} name="dues_cleared_date" label="Dues cleared on" type="date" />
          <TextareaField control={form.control} name="notes" label="Notes" className="sm:col-span-2" rows={2} />
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="possession-form" disabled={pending}>
            {pending ? "Recording…" : "Hand over"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------- transfer */

export function TransferDialog({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [buyers, setBuyers] = useState<PickedBuyer[]>([]);

  const form = useForm<TransferValues, unknown, TransferParsed>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      sale_id: saleId,
      transfer_date: todayPK(),
      transfer_fee: "",
      reason: "",
      notes: "",
      buyers: [],
    },
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await transferSale(values);
      if (!res.ok) {
        applyServerErrors(form.setError, res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    }),
  );

  const setPicked = (next: PickedBuyer[]) => {
    setBuyers(next);
    form.setValue(
      "buyers",
      next.map((b) => ({ client_id: b.client_id, share_pct: b.share_pct, is_primary: b.is_primary })),
      { shouldValidate: form.formState.isSubmitted },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowLeftRight /> Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer this booking</DialogTitle>
          <DialogDescription>
            The sale continues unchanged — the schedule, receipts and ledger stay with the plot. Only the owners change.
          </DialogDescription>
        </DialogHeader>
        <form id="transfer-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="transfer_date" label="Transfer date" type="date" />
          <TextField
            control={form.control}
            name="transfer_fee"
            label="Transfer fee (Rs)"
            inputMode="decimal"
            description="Charged outside the sale ledger"
          />
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium">New owner(s)</p>
            <BuyerPicker
              value={buyers}
              onChange={setPicked}
              error={form.formState.errors.buyers?.message as string | undefined}
            />
          </div>
          <TextField control={form.control} name="reason" label="Reason" className="sm:col-span-2" />
          <TextareaField control={form.control} name="notes" label="Notes" className="sm:col-span-2" rows={2} />
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="transfer-form" disabled={pending}>
            {pending ? "Transferring…" : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- cancellation */

export function CancelSaleDialog({
  saleId,
  salePrice,
  received,
  defaultDeductionPct,
}: {
  saleId: string;
  salePrice: number;
  received: number;
  defaultDeductionPct: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<CancellationValues, unknown, CancellationParsed>({
    resolver: zodResolver(cancellationSchema),
    defaultValues: {
      sale_id: saleId,
      cancelled_on: todayPK(),
      deduction_pct: String(defaultDeductionPct),
      reason: "",
    },
  });
  const pctRaw = useWatch({ control: form.control, name: "deduction_pct" });
  const pct = Number(pctRaw) || 0;
  // mirrors cancel_sale(): the deduction is a share of the SALE PRICE, and the refund floors at zero
  const deduction = Math.round(((salePrice * pct) / 100) * 100) / 100;
  const refund = Math.max(Math.round((received - deduction) * 100) / 100, 0);

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await cancelSale(values);
      if (!res.ok) {
        applyServerErrors(form.setError, res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Ban /> Cancel booking
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this booking</DialogTitle>
          <DialogDescription>
            The plot returns to available. The refund is not payable until the plot is re-sold.
          </DialogDescription>
        </DialogHeader>
        <form id="cancel-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="cancelled_on" label="Cancelled on" type="date" />
          <TextField control={form.control} name="deduction_pct" label="Deduction (% of sale price)" inputMode="decimal" />
          <TextareaField control={form.control} name="reason" label="Reason" className="sm:col-span-2" rows={2} />
        </form>

        <dl className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <dt className="text-muted-foreground">Sale price</dt>
          <dd className="text-right tabular-nums">{formatPKR(salePrice)}</dd>
          <dt className="text-muted-foreground">Received (cleared)</dt>
          <dd className="text-right tabular-nums">{formatPKR(received)}</dd>
          <dt className="text-muted-foreground">Deduction at {pct}%</dt>
          <dd className="text-right tabular-nums">− {formatPKR(deduction)}</dd>
          <dt className="font-medium">Refund due</dt>
          <dd className="text-right font-semibold tabular-nums">{formatPKR(refund)}</dd>
          {deduction > received && (
            <dd className="col-span-2 text-xs text-muted-foreground">
              The deduction is more than what was received, so nothing is refundable.
            </dd>
          )}
        </dl>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Keep booking
          </Button>
          <Button type="submit" form="cancel-form" variant="destructive" disabled={pending}>
            {pending ? "Cancelling…" : "Cancel booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
