import { CATEGORY_LABELS, SIZE_UNIT_LABELS } from "@/lib/labels";
import type { Enums } from "@/types/database";

export function formatSize(value: number | string, unit: Enums<"size_unit">, areaSqft?: number | string | null) {
  const v = Number(value);
  const main = `${Number.isInteger(v) ? v : v.toFixed(2)} ${SIZE_UNIT_LABELS[unit]}`;
  if (unit === "sqft" || areaSqft === undefined || areaSqft === null) return main;
  return `${main} (${Number(areaSqft).toLocaleString("en-PK")} sq ft)`;
}

/** "Block A · Street 2 · 204" / "Tower A · 5th · 504" */
export function unitLocation(u: {
  unit_no: string;
  street?: string | null;
  blocks?: { name: string } | null;
  floors?: { label: string } | null;
}) {
  return [u.blocks?.name, u.street, u.floors?.label ? `${u.floors.label} floor` : null, u.unit_no]
    .filter(Boolean)
    .join(" · ");
}

export function unitTitle(u: { unit_no: string; category: Enums<"unit_category"> }) {
  return `${CATEGORY_LABELS[u.category]} ${u.unit_no}`;
}

export function unitFeatures(u: { is_corner: boolean; is_park_facing: boolean; is_main_boulevard: boolean }) {
  return [u.is_corner && "Corner", u.is_park_facing && "Park facing", u.is_main_boulevard && "Main boulevard"].filter(
    Boolean,
  ) as string[];
}
