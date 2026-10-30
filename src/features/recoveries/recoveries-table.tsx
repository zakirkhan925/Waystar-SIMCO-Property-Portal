"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AgingBadge } from "@/features/sales/badges";
import type { RecoveryRow } from "./queries";
import { reminderText, whatsappLink } from "./reminder";

export function RecoveriesTable({ rows, companyName }: { rows: RecoveryRow[]; companyName: string }) {
  const [draft, setDraft] = useState<{ row: RecoveryRow; text: string } | null>(null);

  const openReminder = (row: RecoveryRow) =>
    setDraft({
      row,
      text: reminderText({
        clientName: row.client_name,
        unitNo: row.unit_no,
        projectName: row.project_name ?? "",
        label: row.label,
        dueDate: row.due_date,
        outstanding: row.outstanding,
        daysOverdue: row.days_overdue,
        companyName,
      }),
    });

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.text);
      toast.success("Reminder copied.");
    } catch {
      toast.error("Could not copy — select the text and copy it by hand.");
    }
  };

  if (rows.length === 0) {
    return <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Nothing in this bucket.</p>;
  }

  const phone = draft?.row.client_whatsapp ?? draft?.row.client_phone ?? "";

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Installment</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Age</TableHead>
              <TableHead className="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.installment_id} className={cn(r.aging_bucket === "90_plus" && "bg-rose-50/60 dark:bg-rose-950/20")}>
                <TableCell>
                  <Link href={`/sales/${r.sale_id}`} className="font-medium hover:underline">
                    {r.unit_no}
                  </Link>
                </TableCell>
                <TableCell>
                  <div>{r.client_name}</div>
                  <div className="text-xs text-muted-foreground">{r.client_phone}</div>
                </TableCell>
                <TableCell>{r.label}</TableCell>
                <TableCell>
                  {r.due_date ? formatDate(r.due_date) : "On notice"}
                  {(r.days_overdue ?? 0) > 0 && (
                    <div className="text-xs text-rose-600 dark:text-rose-400">{r.days_overdue} days late</div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatPKR(r.outstanding)}</TableCell>
                <TableCell>
                  <AgingBadge bucket={r.aging_bucket ?? "not_due"} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Write a reminder for ${r.client_name}`}
                    onClick={() => openReminder(r)}
                  >
                    <MessageCircle />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reminder for {draft?.row.client_name}</DialogTitle>
            <DialogDescription>
              Edit it if you like, then send it on WhatsApp or copy it for SMS. Nothing is sent from the portal.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={14}
            value={draft?.text ?? ""}
            onChange={(e) => setDraft((d) => (d ? { ...d, text: e.target.value } : d))}
            aria-label="Reminder message"
          />
          <DialogFooter>
            <Button variant="outline" onClick={copy}>
              <Copy /> Copy
            </Button>
            <Button asChild disabled={!phone}>
              <a href={whatsappLink(phone, draft?.text ?? "")} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Open WhatsApp
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
