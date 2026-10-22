"use client";

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Base<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: React.ReactNode;
  className?: string;
};

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...input
}: Base<T> & Omit<React.ComponentProps<typeof Input>, "name">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input id={name} aria-invalid={fieldState.invalid} {...input} {...field} value={field.value ?? ""} />
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...input
}: Base<T> & Omit<React.ComponentProps<typeof Textarea>, "name">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Textarea id={name} aria-invalid={fieldState.invalid} {...input} {...field} value={field.value ?? ""} />
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  options,
  placeholder,
  disabled,
  onValueChange,
}: Base<T> & {
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  onValueChange?: (v: string) => void;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Select
            value={field.value || undefined}
            onValueChange={(v) => {
              field.onChange(v);
              onValueChange?.(v);
            }}
            disabled={disabled}
          >
            <SelectTrigger id={name} aria-invalid={fieldState.invalid} className="w-full" onBlur={field.onBlur}>
              <SelectValue placeholder={placeholder ?? "Select…"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

export function CheckboxField<T extends FieldValues>({ control, name, label, className }: Base<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" className={className}>
          <Checkbox id={name} checked={!!field.value} onCheckedChange={(c) => field.onChange(c === true)} />
          <FieldLabel htmlFor={name} className="font-normal">
            {label}
          </FieldLabel>
        </Field>
      )}
    />
  );
}

/** Copy server-side field errors from an ActionResult onto the form. */
export function applyServerErrors(
  setError: (name: never, error: { message: string }) => void,
  fieldErrors?: Record<string, string[]>,
) {
  for (const [k, msgs] of Object.entries(fieldErrors ?? {})) {
    if (msgs?.[0]) setError(k as never, { message: msgs[0] });
  }
}
