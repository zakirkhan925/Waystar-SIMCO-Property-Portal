"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applyServerErrors, CheckboxField, SelectField, TextareaField, TextField } from "@/components/forms/fields";
import { CATEGORY_LABELS, SIZE_UNIT_LABELS, UNIT_STATUS_LABELS } from "@/lib/labels";
import { formatPKR } from "@/lib/money";
import type { ProjectStructure } from "@/features/projects/queries";
import { createUnit, updateUnit } from "./actions";
import { unitFormSchema, type UnitFormParsed, type UnitFormValues } from "./schemas";

type Props = {
  projectId: string;
  isPlotSociety: boolean;
  sqftPerMarla: number;
  structure: ProjectStructure;
  unitId?: string;
  initial?: Partial<UnitFormValues>;
  /** booked / sold / rented units: status can't be edited here */
  statusLocked?: boolean;
};

export function UnitForm({ projectId, isPlotSociety, sqftPerMarla, structure, unitId, initial, statusLocked }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<UnitFormValues, unknown, UnitFormParsed>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: {
      block_id: structure[0]?.id ?? "",
      floor_id: "",
      street: "",
      unit_no: "",
      category: isPlotSociety ? "plot" : "apartment",
      use: isPlotSociety ? "residential" : "residential",
      size_value: "",
      size_unit: isPlotSociety ? "marla" : "sqft",
      bedrooms: "",
      bathrooms: "",
      is_corner: false,
      is_park_facing: false,
      is_main_boulevard: false,
      base_price: "",
      price_per_sqft: "",
      status: "available",
      notes: "",
      reason: "",
      ...initial,
    },
  });
  const { control } = form;
  const [blockId, category, sizeValue, sizeUnit, basePrice] = useWatch({
    control,
    name: ["block_id", "category", "size_value", "size_unit", "base_price"],
  });
  const floors = structure.find((b) => b.id === blockId)?.floors ?? [];

  // Live preview of area and rate (display only; the database computes the stored values).
  const size = Number(String(sizeValue).replace(/,/g, "")) || 0;
  const area = sizeUnit === "sqft" ? size : sizeUnit === "marla" ? size * sqftPerMarla : size * sqftPerMarla * 20;
  const price = Number(String(basePrice).replace(/,/g, "")) || 0;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = unitId ? await updateUnit(unitId, values) : await createUnit(projectId, values);
      if (!res.ok) {
        applyServerErrors(form.setError, res.fieldErrors);
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      const id = unitId ?? (res.data as { id: string } | undefined)?.id;
      router.push(id ? `/units/${id}` : `/projects/${projectId}`);
      router.refresh();
    }),
  );

  const categoryOptions = (isPlotSociety ? (["plot", "other"] as const) : (["shop", "office", "apartment", "penthouse", "other"] as const)).map(
    (c) => ({ value: c, label: CATEGORY_LABELS[c] }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            control={control}
            name="block_id"
            label={isPlotSociety ? "Block" : "Tower"}
            options={structure.map((b) => ({ value: b.id, label: b.name }))}
            onValueChange={() => form.setValue("floor_id", "")}
          />
          {isPlotSociety ? (
            <TextField control={control} name="street" label="Street" placeholder="Street 4" />
          ) : (
            <SelectField
              control={control}
              name="floor_id"
              label="Floor"
              options={floors.map((f) => ({ value: f.id, label: f.label }))}
              disabled={!blockId}
            />
          )}
          <TextField control={control} name="unit_no" label={isPlotSociety ? "Plot no." : "Unit no."} placeholder={isPlotSociety ? "412" : "504"} />
          <SelectField control={control} name="category" label="Category" options={categoryOptions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Specifications</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            control={control}
            name="use"
            label="Use"
            options={[
              { value: "residential", label: "Residential" },
              { value: "commercial", label: "Commercial" },
            ]}
          />
          <TextField control={control} name="size_value" label="Size" inputMode="decimal" />
          <SelectField
            control={control}
            name="size_unit"
            label="Size unit"
            options={(["marla", "kanal", "sqft"] as const).map((u) => ({ value: u, label: SIZE_UNIT_LABELS[u] }))}
            description={area ? `= ${area.toLocaleString("en-PK")} sq ft` : `1 marla = ${sqftPerMarla} sq ft`}
          />
          {category !== "plot" && (
            <>
              <TextField control={control} name="bedrooms" label="Bedrooms" inputMode="numeric" />
              <TextField control={control} name="bathrooms" label="Bathrooms" inputMode="numeric" />
            </>
          )}
          <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-4 sm:flex-row sm:gap-6">
            <CheckboxField control={control} name="is_corner" label="Corner" />
            <CheckboxField control={control} name="is_park_facing" label="Park facing" />
            <CheckboxField control={control} name="is_main_boulevard" label="Main boulevard" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing & status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            control={control}
            name="base_price"
            label="Base price (Rs)"
            inputMode="decimal"
            description={price ? formatPKR(price) : undefined}
          />
          <TextField
            control={control}
            name="price_per_sqft"
            label="Price per sq ft (Rs)"
            inputMode="decimal"
            description={price && area ? `Leave blank to use ${formatPKR(Math.round(price / area))}` : "Optional"}
          />
          <SelectField
            control={control}
            name="status"
            label="Status"
            disabled={statusLocked}
            options={(["available", "on_hold", "blocked"] as const).map((s) => ({ value: s, label: UNIT_STATUS_LABELS[s] }))}
            description={statusLocked ? "Set automatically by the sale / lease" : "Booked, sold and rented are set automatically"}
          />
          <TextareaField control={control} name="notes" label="Notes" className="sm:col-span-2 lg:col-span-4" rows={2} />
          {unitId && (
            <TextField
              control={control}
              name="reason"
              label="Reason for change (recorded in the activity log)"
              placeholder="e.g. Price revised per SIMCO circular"
              className="sm:col-span-2 lg:col-span-4"
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : unitId ? "Save changes" : "Add unit"}
        </Button>
      </div>
    </form>
  );
}
