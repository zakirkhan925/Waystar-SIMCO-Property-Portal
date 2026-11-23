"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Constants } from "@/types/database";
import { todayPK } from "@/lib/dates";
import { paymentModeLabels } from "./terms";

export type Option = { value: string; label: string };
export type Field = {
  name: string; label: string; type?: "date" | "money" | "number" | "textarea";
  value?: string; min?: string; max?: string; required?: boolean; options?: Option[];
};

export function RentalField({ field, onChange }: { field: Field; onChange?: (value: string) => void }) {
  const id = useId();
  const props = { id, name: field.name, defaultValue: field.value, required: field.required ?? true,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange?.(event.target.value) };
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      {field.options ? (
        <select {...props} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : field.type === "textarea" ? (
        <Textarea {...props} rows={2} />
      ) : (
        <Input {...props} type={field.type === "money" ? "text" : field.type}
          inputMode={field.type === "money" ? "decimal" : undefined} min={field.min} max={field.max} />
      )}
    </div>
  );
}

export function termFields(values: Partial<Record<"start_date" | "end_date" | "monthly_rent" | "security_deposit" |
  "rent_due_day" | "increment_pct" | "commission_pct" | "notes", string>>): Field[] {
  return [
    { name: "start_date", label: "Start date", type: "date", value: values.start_date ?? todayPK() },
    { name: "end_date", label: "End date", type: "date", value: values.end_date },
    { name: "monthly_rent", label: "Monthly rent (PKR)", type: "money", value: values.monthly_rent },
    { name: "rent_due_day", label: "Rent due day", type: "number", min: "1", max: "28", value: values.rent_due_day ?? "1" },
    { name: "increment_pct", label: "Yearly increase (%)", type: "money", value: values.increment_pct ?? "10" },
    { name: "commission_pct", label: "Commission (%)", type: "money", value: values.commission_pct ?? "5" },
    { name: "security_deposit", label: "Security deposit (PKR)", type: "money", value: values.security_deposit ?? "0" },
    { name: "notes", label: "Notes", type: "textarea", value: values.notes, required: false },
  ];
}

export const paymentModeField: Field = {
  name: "mode", label: "Payment mode",
  options: Constants.public.Enums.payment_mode.map((value) => ({ value, label: paymentModeLabels[value] })),
};
