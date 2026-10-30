import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { InstallmentStatusBadge } from "./badges";
import type { InstallmentRow } from "./queries";

export function ScheduleTable({ installments }: { installments: InstallmentRow[] }) {
  if (installments.length === 0) {
    return <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No schedule yet.</p>;
  }
  const sum = (pick: (i: InstallmentRow) => number | string) =>
    installments.reduce((n, i) => n + Number(pick(i)), 0);
  const outstanding = (i: InstallmentRow) =>
    Number(i.amount_due) + Number(i.late_fee) - Number(i.amount_paid) - Number(i.waived_amount);

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Milestone</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map((i) => (
            <TableRow key={i.id} className={cn(i.status === "overdue" && "bg-rose-50/60 dark:bg-rose-950/20")}>
              <TableCell className="text-muted-foreground">{i.seq}</TableCell>
              <TableCell className="font-medium">{i.label}</TableCell>
              <TableCell>
                {i.due_date ? formatDate(i.due_date) : <span className="text-muted-foreground">On notice</span>}
                {i.days_overdue > 0 && (
                  <div className="text-xs text-rose-600 dark:text-rose-400">{i.days_overdue} days late</div>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatPKR(i.amount_due)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPKR(i.amount_paid)}
                {Number(i.amount_pending) > 0 && (
                  <div className="text-xs text-amber-600 dark:text-amber-400">
                    {formatPKR(i.amount_pending)} awaiting clearance
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatPKR(Math.max(0, outstanding(i)))}</TableCell>
              <TableCell>
                <InstallmentStatusBadge status={i.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right tabular-nums">{formatPKR(sum((i) => i.amount_due))}</TableCell>
            <TableCell className="text-right tabular-nums">{formatPKR(sum((i) => i.amount_paid))}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatPKR(installments.reduce((n, i) => n + Math.max(0, outstanding(i)), 0))}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
