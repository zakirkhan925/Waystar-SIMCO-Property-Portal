"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Check, FileText, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, todayPK } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import type { ActionResult } from "@/lib/action-result";
import { bounceInstrument, clearInstrument, reversePayment } from "./actions";
import { ReceiptStatusBadge } from "./badges";
import { PAYMENT_MODE_LABELS } from "./schemas";
import type { PaymentRow } from "./queries";

type Pending = { kind: "clear" | "bounce" | "reverse"; payment: PaymentRow } | null;

const COPY = {
  clear: {
    title: "Mark as cleared",
    description: "Record that the bank has cleared this instrument. Only then does it count as money received.",
    label: "Cleared on",
    confirm: "Mark cleared",
  },
  bounce: {
    title: "Mark as bounced",
    description: "The instrument failed. It will stop counting towards this sale, and the installments it settled reopen.",
    label: "Reason",
    confirm: "Mark bounced",
  },
  reverse: {
    title: "Reverse this receipt",
    description: "The receipt is kept with its reason — receipts are never deleted — but it stops counting towards this sale.",
    label: "Reason",
    confirm: "Reverse receipt",
  },
} as const;

export function PaymentsList({ payments, saleId, canHandleMoney }: { payments: PaymentRow[]; saleId: string; canHandleMoney: boolean }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<Pending>(null);
  const [value, setValue] = useState("");
  const [busy, startTransition] = useTransition();

  const open = (kind: NonNullable<Pending>["kind"], payment: PaymentRow) => {
    setPendingAction({ kind, payment });
    setValue(kind === "clear" ? todayPK() : "");
  };

  const confirm = () => {
    if (!pendingAction) return;
    const { kind, payment } = pendingAction;
    startTransition(async () => {
      const run: Promise<ActionResult> =
        kind === "clear"
          ? clearInstrument(payment.id, saleId, value)
          : kind === "bounce"
            ? bounceInstrument(payment.id, saleId, value)
            : reversePayment(payment.id, saleId, value);
      const res = await run;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setPendingAction(null);
      router.refresh();
    });
  };

  if (payments.length === 0) {
    return <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No payments recorded yet.</p>;
  }

  const copy = pendingAction ? COPY[pendingAction.kind] : null;
  const canConfirm = pendingAction?.kind === "clear" ? !!value : value.trim().length >= 3;

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Receipt</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => {
              const reversed = p.status === "reversed";
              return (
                <TableRow key={p.id} className={reversed ? "opacity-60" : undefined}>
                  <TableCell className="font-mono text-xs">{p.receipt_no}</TableCell>
                  <TableCell>{formatDate(p.received_on)}</TableCell>
                  <TableCell>
                    <div>{PAYMENT_MODE_LABELS[p.mode]}</div>
                    {p.instrument_no && (
                      <div className="text-xs text-muted-foreground">
                        {p.bank_name} {p.instrument_no}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${reversed ? "line-through" : ""}`}>
                    {formatPKR(p.amount)}
                  </TableCell>
                  <TableCell>
                    <ReceiptStatusBadge status={p.status} instrument={p.instrument_status} />
                    {p.bounced_reason && <div className="mt-1 text-xs text-muted-foreground">{p.bounced_reason}</div>}
                    {p.reversal_reason && <div className="mt-1 text-xs text-muted-foreground">{p.reversal_reason}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`Print receipt ${p.receipt_no}`} asChild>
                        <a href={`/api/pdf/receipt/${p.id}`} target="_blank" rel="noopener noreferrer">
                          <FileText />
                        </a>
                      </Button>
                      {canHandleMoney && !reversed && (
                        <>
                          {p.instrument_status === "pending" && (
                            <Button variant="ghost" size="icon-sm" aria-label="Mark cleared" onClick={() => open("clear", p)}>
                              <Check />
                            </Button>
                          )}
                          {(p.instrument_status === "pending" || p.instrument_status === "cleared") && (
                            <Button variant="ghost" size="icon-sm" aria-label="Mark bounced" onClick={() => open("bounce", p)}>
                              <Ban />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon-sm" aria-label="Reverse receipt" onClick={() => open("reverse", p)}>
                            <Undo2 />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <DialogContent>
          {copy && (
            <>
              <DialogHeader>
                <DialogTitle>{copy.title}</DialogTitle>
                <DialogDescription>{copy.description}</DialogDescription>
              </DialogHeader>
              <Field>
                <FieldLabel htmlFor="confirm-value">{copy.label}</FieldLabel>
                {pendingAction?.kind === "clear" ? (
                  <Input id="confirm-value" type="date" value={value} onChange={(e) => setValue(e.target.value)} />
                ) : (
                  <Textarea id="confirm-value" rows={2} value={value} onChange={(e) => setValue(e.target.value)} />
                )}
              </Field>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPendingAction(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  variant={pendingAction?.kind === "clear" ? "default" : "destructive"}
                  onClick={confirm}
                  disabled={busy || !canConfirm}
                >
                  {busy ? "Saving…" : copy.confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
