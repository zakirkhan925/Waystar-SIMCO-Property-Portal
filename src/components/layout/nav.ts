import {
  BarChart3,
  Building2,
  HandCoins,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Undo2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/labels";
import { PAYMENTS_ROLES } from "@/features/payments/filters";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: AppRole[]; // omitted = every staff role
};

// Later phases add Rentals.
// Possession, transfers and cancellations live on the sale they belong to rather than as
// screens of their own; only refunds need a list, because Accounts chase them.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects & Inventory", icon: Building2 },
  { href: "/sales", label: "Sales", icon: ReceiptText },
  { href: "/payments", label: "Payments", icon: Wallet, roles: PAYMENTS_ROLES },
  { href: "/recoveries", label: "Recoveries", icon: HandCoins, roles: ["super_admin", "manager", "accounts", "viewer"] },
  { href: "/refunds", label: "Refunds", icon: Undo2, roles: ["super_admin", "manager", "accounts", "viewer"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: PAYMENTS_ROLES },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["super_admin", "manager"] },
];

export function navFor(role: AppRole) {
  return NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
}
