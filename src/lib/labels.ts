import type { Enums } from "@/types/database";

export type AppRole = Enums<"app_role">;
export type UnitStatus = Enums<"unit_status">;

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  sales_agent: "Sales Agent",
  accounts: "Accounts",
  viewer: "Viewer (SIMCO)",
  client: "Client",
};

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  available: "Available",
  on_hold: "On hold",
  booked: "Booked",
  sold: "Sold",
  rented: "Rented",
  blocked: "Blocked",
};

/** Tailwind classes per status — used by the inventory grid, badges and legend. */
export const UNIT_STATUS_STYLES: Record<UnitStatus, string> = {
  available: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
  on_hold: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
  booked: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800",
  sold: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800",
  rented: "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-800",
  blocked: "bg-zinc-200 text-zinc-700 border-zinc-400 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600",
};

export const CATEGORY_LABELS: Record<Enums<"unit_category">, string> = {
  plot: "Plot",
  apartment: "Apartment",
  shop: "Shop",
  office: "Office",
  penthouse: "Penthouse",
  other: "Other",
};

export const SIZE_UNIT_LABELS: Record<Enums<"size_unit">, string> = {
  marla: "Marla",
  kanal: "Kanal",
  sqft: "sq ft",
};

export const PROJECT_TYPE_LABELS: Record<Enums<"project_type">, string> = {
  plot_society: "Residential society (plots)",
  high_rise: "High-rise (shops / offices / apartments)",
};

export const PROJECT_STATUS_LABELS: Record<Enums<"project_status">, string> = {
  off_plan: "Off-plan",
  under_construction: "Under construction",
  completed: "Completed",
};
