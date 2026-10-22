import { z } from "zod";

const optNum = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : Number(String(v).replace(/,/g, ""))),
  z.number().nonnegative().optional(),
);
const optStr = z.preprocess((v) => (v === "" || v === "all" ? undefined : v), z.string().max(80).optional());

export const UNIT_SORTS = ["unit_no", "base_price", "area_sqft", "status", "category"] as const;

export const unitFiltersSchema = z.object({
  view: z.enum(["grid", "table"]).catch("grid"),
  q: optStr,
  block: optStr,
  floor: optStr,
  category: z.enum(["plot", "apartment", "shop", "office", "penthouse", "other"]).optional().catch(undefined),
  status: z.enum(["available", "on_hold", "booked", "sold", "rented", "blocked"]).optional().catch(undefined),
  minSize: optNum.catch(undefined),
  maxSize: optNum.catch(undefined),
  minPrice: optNum.catch(undefined),
  maxPrice: optNum.catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  size: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n)).catch(25),
  sort: z.enum(UNIT_SORTS).catch("unit_no"),
  dir: z.enum(["asc", "desc"]).catch("asc"),
});

export type UnitFilters = z.infer<typeof unitFiltersSchema>;

export function parseUnitFilters(sp: Record<string, string | string[] | undefined>): UnitFilters {
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return unitFiltersSchema.parse(flat);
}
