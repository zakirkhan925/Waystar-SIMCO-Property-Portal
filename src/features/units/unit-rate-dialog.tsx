"use client";

import { Calculator } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectStructure } from "@/features/projects/queries";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatPKR } from "@/lib/money";
import { setUnitRate, type UnitRateResult } from "./actions";
import type { UnitRateValues } from "./schemas";

const ALL = "all";
const CATEGORIES = ["shop", "office", "apartment", "penthouse", "other"] as const;

/** Same clean-up the server applies, so the preview only runs on a usable number. */
function cleanRate(v: string) {
  const r = v.replace(/[,\s]/g, "").replace(/^rs\.?/i, "");
  return /^\d{1,12}(\.\d{1,2})?$/.test(r) && Number(r) > 0 ? r : null;
}

export function UnitRateDialog({
  projectId,
  structure,
  isPlotSociety,
}: {
  projectId: string;
  structure: ProjectStructure;
  isPlotSociety: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [block, setBlock] = useState(structure.length === 1 ? structure[0].id : ALL);
  const [floor, setFloor] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [rate, setRate] = useState("");
  const [reason, setReason] = useState("");
  // The preview is tied to the exact inputs it was calculated for; Apply is only enabled when they still match.
  const [preview, setPreview] = useState<{ key: string; result: UnitRateResult } | null>(null);
  const [checking, startCheck] = useTransition();
  const [saving, startSave] = useTransition();

  const floors = structure.find((b) => b.id === block)?.floors ?? [];
  const clean = cleanRate(rate);
  const values: UnitRateValues = {
    rate: clean ?? "",
    block_id: block === ALL ? "" : block,
    floor_id: floor === ALL ? "" : floor,
    category: category === ALL ? "" : (category as UnitRateValues["category"]),
    reason,
  };
  const key = JSON.stringify([values.rate, values.block_id, values.floor_id, values.category]);
  const current = preview?.key === key ? preview.result : null;

  useEffect(() => {
    if (!open || !clean) return;
    const t = setTimeout(() => {
      startCheck(async () => {
        const res = await setUnitRate(projectId, values, true);
        if (res.ok && res.data) setPreview({ key, result: res.data });
        else if (!res.ok) toast.error(res.error);
      });
    }, 400);
    return () => clearTimeout(t);
    // `values` is rebuilt every render; `key` captures everything the preview depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key, projectId]);

  const apply = () =>
    startSave(async () => {
      const res = await setUnitRate(projectId, values, false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      setRate("");
      setReason("");
      setPreview(null);
      router.refresh();
    });

  const scopeLabel = [
    block === ALL ? (isPlotSociety ? "all blocks" : "all towers") : structure.find((b) => b.id === block)?.name,
    !isPlotSociety && floor !== ALL ? floors.find((f) => f.id === floor)?.label + " floor" : null,
    category !== ALL ? CATEGORY_LABELS[category as (typeof CATEGORIES)[number]].toLowerCase() + "s" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Calculator /> Set rate per sq ft
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set rate per sq ft</DialogTitle>
          <DialogDescription>
            Each unit&apos;s base price becomes its area × the rate, rounded to whole rupees. Booked, sold and rented
            units keep their price.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="rate-block">{isPlotSociety ? "Block" : "Tower"}</FieldLabel>
            <Select
              value={block}
              onValueChange={(v) => {
                setBlock(v);
                setFloor(ALL);
              }}
            >
              <SelectTrigger id="rate-block" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{isPlotSociety ? "All blocks" : "All towers"}</SelectItem>
                {structure.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {!isPlotSociety && (
            <Field>
              <FieldLabel htmlFor="rate-floor">Floor</FieldLabel>
              <Select value={floor} onValueChange={setFloor} disabled={block === ALL}>
                <SelectTrigger id="rate-floor" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All floors</SelectItem>
                  {floors.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {!isPlotSociety && (
            <Field>
              <FieldLabel htmlFor="rate-category">Category</FieldLabel>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="rate-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="rate-value">Rate per sq ft (Rs)</FieldLabel>
            <Input
              id="rate-value"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 45000"
              autoComplete="off"
            />
            {rate && !clean && <FieldDescription className="text-destructive">Enter a rate greater than zero.</FieldDescription>}
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="rate-reason">Note (optional)</FieldLabel>
          <Textarea
            id="rate-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Price list of 22-Nov-2026"
          />
        </Field>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm" aria-live="polite">
          {!clean ? (
            <span className="text-muted-foreground">Enter a rate to see how many units will be repriced.</span>
          ) : !current ? (
            <span className="text-muted-foreground">{checking ? "Checking…" : "…"}</span>
          ) : current.units === 0 ? (
            <span>No free units in {scopeLabel}.</span>
          ) : (
            <div className="space-y-1">
              <p>
                <strong>{current.units}</strong> {current.units === 1 ? "unit" : "units"} in {scopeLabel} at{" "}
                <strong>{formatPKR(clean)}</strong> per sq ft.
              </p>
              <p>
                New total value: <strong>{formatPKR(current.totalValue)}</strong>
              </p>
              {current.skippedSold > 0 && (
                <p className="text-muted-foreground">
                  {current.skippedSold} booked / sold / rented {current.skippedSold === 1 ? "unit is" : "units are"} not changed.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={saving || checking || !current || current.units === 0}>
            {saving ? "Saving…" : current && current.units > 0 ? `Reprice ${current.units} units` : "Reprice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
