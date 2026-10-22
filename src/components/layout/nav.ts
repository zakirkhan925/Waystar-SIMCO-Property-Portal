import { Building2, LayoutDashboard, Settings, Users, type LucideIcon } from "lucide-react";
import type { AppRole } from "@/lib/labels";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: AppRole[]; // omitted = every staff role
};

// Later phases add: Bookings, Payments, Recoveries, Possession, Transfers, Rentals, Reports.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects & Inventory", icon: Building2 },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["super_admin", "manager"] },
];

export function navFor(role: AppRole) {
  return NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
}
