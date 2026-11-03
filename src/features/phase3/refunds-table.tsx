"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { applyServerErrors, TextField } from "@/components/forms/fields";
import { formatDate, todayPK } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { settleRefund } from "./actions";
import { refundSchema, REFUND_STATUS_LABELS, type RefundParsed, type RefundValues } from "./schemas";
import type { RefundRow } from "./queries";

function StatusBadge({ status, daysOverdue }: { status: string; daysOverdue: number | null }) {
  const label = REFUND_STATUS_LABELS[status as keyof typeof REFUND_STATUS_LABELS] ?? status;
  if (status === "paid") return <Badge variant="secondary">{label}</Badge>;
  if (status === "payable") {
    return Number(daysOverdue ?? 0) > 0 ? (
      <Badge variant="destructive">{daysOverdue} days late</Badge>
    ) : (
      <Badge>{label}</Badge>
    );
  }
  return <Badge variant="outline">{label}</Badge>;
}

export function RefundsTable({ rows, canSettle }: { rows: RefundRow[]; canSettle: boolean }) {
  const router = useRouter();
  const [target, setTarget] = useState<RefundRow | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<RefundValues, unknown, RefundParsed>({
    resolver: zodResolver(refundSchema),
    defaultValues: { cancellation_id: "", paid_on: todayPK(), reference: "", reason: "" },
  });

  const openFor = (r: RefundRow) => {
    form.reset({ cancellation_id: r.cancellation_id as string, paid_on: todayPK(), reference: "", reason: "" });
    setTarget(r);
  };

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await settleRefund(values);
      if (!res.ok) {
        applyServerErrors(form.setError, res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setTarget(null);
      router.refresh();
    }),
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border py-16 text-center text-sm text-muted-foreground">
        No cancellations yet, so nothing is owed back.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Plot</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Cancelled</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Deduction</TableHead>
              <TableHead className="text-right">Refund due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.cancellation_id as string}>
                <TableCell className="font-medium">{r.cancellation_no}</TableCell>
                <TableCell>
                  <Link className="underline-offset-2 hover:underline" href={`/sales/${r.sale_id}`}>
                    {r.project_code} · {r.unit_no}
                  </Link>
                </TableCell>
                <TableCell>{r.client_name ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(r.cancelled_on as string)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPKR(r.amount_received ?? 0)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  − {formatPKR(r.deduction_amount ?? 0)}
                  <span className="ml-1 text-xs">({Number(r.deduction_pct)}%)</span>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatPKR(r.refund_due ?? 0)}</TableCell>
                <TableCell>
                  <StatusBadge status={r.refund_status as string} daysOverdue={r.days_overdue as number | null} />
                  {r.refund_status === "payable" && r.refund_due_date && (
                    <div className="text-xs text-muted-foreground">due {formatDate(r.refund_due_date as string)}</div>
                  )}
                  {r.refund_status === "paid" && r.refunded_on && (
                    <div className="text-xs text-muted-foreground">{formatDate(r.refunded_on as string)}</div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canSettle && r.refund_status !== "paid" && r.refund_status !== "waived" && Number(r.refund_due) > 0 && (
                    <Button size="sm" variant="outline" onClick={() => openFor(r)}>
                      Record refund
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record a refund</DialogTitle>
            <DialogDescription>
              {target ? (
                <>
                  {formatPKR(target.refund_due ?? 0)} back to {target.client_name ?? "the buyer"} for plot {target.unit_no}.
                  {target.refund_status === "pending_resale" &&
                    " This plot has not been re-sold yet, so paying now is an early release."}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <form id="refund-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="paid_on" label="Paid on" type="date" />
            <TextField control={form.control} name="reference" label="Reference" placeholder="Cheque / transfer no." />
            <TextField control={form.control} name="reason" label="Reason / note" className="sm:col-span-2" />
          </form>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" form="refund-form" disabled={pending}>
              {pending ? "Saving…" : "Record refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
