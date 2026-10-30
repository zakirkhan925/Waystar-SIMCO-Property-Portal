"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { applyServerErrors, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { formatDate, todayPK } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { buildSchedule, scheduleTotal } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { createBooking } from "./actions";
import { BuyerPicker, type PickedBuyer } from "./buyer-picker";
import { bookingSchema, type BookingParsed, type BookingValues } from "./schemas";
import type { PaymentPlan } from "./queries";

type UnitInfo = {
  id: string;
  unit_no: string;
  base_price: string | number;
  projectName: string;
  projectId: string;
  location: string;
  sizeLabel: string;
  isCorner: boolean;
  cornerPremiumPct: number;
  downPaymentBalanceDays: number | null;
};

const STEPS = ["Buyers", "Price & plan", "Schedule", "Confirm"] as const;

export function BookingWizard({
  unit,
  plans,
  dealers,
  defaultCommissionPct,
}: {
  unit: UnitInfo;
  plans: PaymentPlan[];
  dealers: { id: string; name: string }[];
  defaultCommissionPct: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [buyers, setBuyers] = useState<PickedBuyer[]>([]);
  const [pending, startTransition] = useTransition();

  const defaultPlan = plans.find((p) => p.is_default) ?? plans[0];
  const form = useForm<BookingValues, unknown, BookingParsed>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      unit_id: unit.id,
      booking_date: todayPK(),
      buyers: [],
      list_price: Number(unit.base_price).toFixed(2),
      discount: "",
      plan_kind: defaultPlan?.kind ?? "installment",
      payment_plan_id: defaultPlan?.id ?? "",
      down_payment_pct: String(defaultPlan?.down_payment_pct ?? 30),
      installment_pct: String(defaultPlan?.installment_pct ?? 70),
      possession_pct: String(defaultPlan?.possession_pct ?? 0),
      tenure_months: String(defaultPlan?.tenure_months ?? 24),
      frequency: defaultPlan?.frequency ?? "quarterly",
      booking_amount: "",
      first_installment_date: "",
      dealer_id: "",
      commission_pct: defaultCommissionPct,
      notes: "",
    },
  });
  const { control } = form;
  const w = useWatch({ control });

  const finalPrice = Math.max(0, Number(String(w.list_price ?? "").replace(/,/g, "")) - Number(String(w.discount ?? "").replace(/,/g, "") || 0));

  const lines = useMemo(() => {
    if (!finalPrice || !w.booking_date) return [];
    try {
      return buildSchedule({
        finalPrice: finalPrice.toFixed(2),
        bookingDate: w.booking_date,
        planKind: w.plan_kind ?? "installment",
        downPaymentPct: w.down_payment_pct || "0",
        installmentPct: w.installment_pct || "0",
        possessionPct: w.possession_pct || "0",
        tenureMonths: Number(w.tenure_months) || null,
        frequency: w.plan_kind === "installment" ? (w.frequency || null) : null,
        firstInstallmentDate: w.first_installment_date || null,
        bookingAmount: w.booking_amount || null,
        downPaymentBalanceDays: unit.downPaymentBalanceDays,
      });
    } catch {
      return [];
    }
  }, [finalPrice, w.booking_date, w.plan_kind, w.down_payment_pct, w.installment_pct, w.possession_pct,
      w.tenure_months, w.frequency, w.first_installment_date, w.booking_amount, unit.downPaymentBalanceDays]);

  const applyPlan = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    form.setValue("plan_kind", plan.kind);
    form.setValue("down_payment_pct", String(plan.down_payment_pct));
    form.setValue("installment_pct", String(plan.installment_pct));
    form.setValue("possession_pct", String(plan.possession_pct));
    form.setValue("tenure_months", String(plan.tenure_months ?? ""));
    form.setValue("frequency", (plan.frequency ?? "") as BookingValues["frequency"]);
  };

  const syncBuyers = (next: PickedBuyer[]) => {
    setBuyers(next);
    form.setValue(
      "buyers",
      next.map((b) => ({ client_id: b.client_id, share_pct: b.share_pct, is_primary: b.is_primary })),
      { shouldValidate: form.formState.isSubmitted },
    );
  };

  const canLeaveStep0 = buyers.length > 0 && Math.abs(buyers.reduce((n, b) => n + Number(b.share_pct || 0), 0) - 100) < 0.001
    && buyers.filter((b) => b.is_primary).length === 1;
  const canLeaveStep1 = finalPrice > 0 && lines.length > 0;

  const submit = form.handleSubmit(
    (values) =>
      startTransition(async () => {
        const res = await createBooking(values);
        if (!res.ok) {
          applyServerErrors(form.setError, res.fieldErrors);
          toast.error(res.error);
          return;
        }
        toast.success(res.message);
        router.push(`/sales/${res.data!.id}`);
        router.refresh();
      }),
    () => toast.error("Check the highlighted fields."),
  );

  const buyersError = form.formState.errors.buyers?.message;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1",
                i === step && "border-primary bg-primary text-primary-foreground",
                i < step && "text-muted-foreground hover:bg-muted",
                i > step && "text-muted-foreground opacity-60",
              )}
            >
              <span className="grid size-5 place-items-center rounded-full border text-xs">
                {i < step ? <Check className="size-3" /> : i + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>
            {unit.projectName} · Unit {unit.unit_no}
          </CardTitle>
          <CardDescription>
            {unit.location} · {unit.sizeLabel} · list price {formatPKR(unit.base_price)}
            {unit.isCorner && unit.cornerPremiumPct > 0 && ` · corner (+${unit.cornerPremiumPct}% already in the list price)`}
          </CardDescription>
        </CardHeader>
      </Card>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Who is buying?</CardTitle>
            <CardDescription>Add one buyer, or several for joint ownership. Shares must total 100%.</CardDescription>
          </CardHeader>
          <CardContent>
            <BuyerPicker value={buyers} onChange={syncBuyers} error={buyersError} />
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Price</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField control={control} name="booking_date" label="Booking date" type="date" />
              <TextField control={control} name="list_price" label="List price (Rs)" inputMode="decimal" />
              <TextField
                control={control}
                name="discount"
                label="Discount (Rs)"
                inputMode="decimal"
                description="Managers only"
              />
              <div className="self-end pb-2 text-sm">
                <div className="text-xs text-muted-foreground">Sale price</div>
                <div className="text-lg font-semibold tabular-nums">{formatPKR(finalPrice)}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payment plan</CardTitle>
              <CardDescription>Pick a plan, then adjust it for this booking if you need to.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                control={control}
                name="payment_plan_id"
                label="Plan"
                className="sm:col-span-2"
                options={plans.map((p) => ({ value: p.id, label: p.name }))}
                onValueChange={applyPlan}
              />
              <SelectField
                control={control}
                name="plan_kind"
                label="Type"
                options={[
                  { value: "installment", label: "Down payment + installments" },
                  { value: "full_cash", label: "Full payment" },
                ]}
              />
              <TextField control={control} name="commission_pct" label="Commission %" inputMode="decimal" />
              <TextField control={control} name="down_payment_pct" label="Down payment %" inputMode="decimal" />
              <TextField control={control} name="installment_pct" label="Installments %" inputMode="decimal" />
              <TextField control={control} name="possession_pct" label="On possession %" inputMode="decimal" />
              <TextField
                control={control}
                name="booking_amount"
                label="Booking amount (Rs)"
                inputMode="decimal"
                description={unit.downPaymentBalanceDays === null ? "Part of the down payment" : `Balance due in ${unit.downPaymentBalanceDays} days`}
              />
              {w.plan_kind === "installment" && (
                <>
                  <TextField control={control} name="tenure_months" label="Tenure (months)" inputMode="numeric" />
                  <SelectField
                    control={control}
                    name="frequency"
                    label="Frequency"
                    options={[
                      { value: "monthly", label: "Monthly" },
                      { value: "quarterly", label: "Quarterly" },
                      { value: "bi_annual", label: "Bi-annual" },
                      { value: "annual", label: "Annual" },
                    ]}
                  />
                  <TextField
                    control={control}
                    name="first_installment_date"
                    label="First installment"
                    type="date"
                    description="Blank = one period after booking"
                  />
                </>
              )}
              <SelectField
                control={control}
                name="dealer_id"
                label="Dealer"
                options={[{ value: "", label: "None" }, ...dealers.map((d) => ({ value: d.id, label: d.name }))]}
              />
              <TextareaField control={control} name="notes" label="Notes" rows={2} className="sm:col-span-2 lg:col-span-4" />
            </CardContent>
          </Card>
        </>
      )}

      {step >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Installment schedule</CardTitle>
            <CardDescription>
              A preview. The schedule is generated by the system when you confirm, and will match this exactly.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">#</TableHead>
                  <TableHead>Milestone</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead className="text-right">% of price</TableHead>
                  <TableHead className="pr-6 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.seq}>
                    <TableCell className="pl-6 text-muted-foreground">{l.seq}</TableCell>
                    <TableCell>{l.label}</TableCell>
                    <TableCell>{l.dueDate ? formatDate(l.dueDate) : <span className="text-muted-foreground">On notice</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.pct}%</TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">{formatPKR(l.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="pl-6">
                    Total
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">{formatPKR(scheduleTotal(lines))}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm the booking</CardTitle>
            <CardDescription>
              This marks the unit booked and creates the schedule. It cannot be undone without a Manager cancelling the sale.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Unit</dt>
                <dd className="font-medium">
                  {unit.unit_no} · {unit.projectName}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Buyers</dt>
                <dd className="font-medium">{buyers.map((b) => `${b.label} (${b.share_pct}%)`).join(", ")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Sale price</dt>
                <dd className="font-medium">{formatPKR(finalPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Booking date</dt>
                <dd className="font-medium">{w.booking_date ? formatDate(w.booking_date) : "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => (step === 0 ? router.back() : setStep(step - 1))} disabled={pending}>
          <ChevronLeft /> {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={(step === 0 && !canLeaveStep0) || (step === 1 && !canLeaveStep1)}
          >
            Next <ChevronRight />
          </Button>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? "Booking…" : "Confirm booking"}
          </Button>
        )}
      </div>
    </form>
  );
}
