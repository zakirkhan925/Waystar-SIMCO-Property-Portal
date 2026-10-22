import type { Metadata } from "next";
import Link from "next/link";
import { Building, Building2, UserCog } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can, requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireRole("super_admin", "manager");
  const perms = can(user);
  const items = [
    { href: "/settings/projects", icon: Building2, title: "Projects", desc: "Projects, blocks, towers and floors", show: perms.manageProjects },
    { href: "/settings/users", icon: UserCog, title: "Users & roles", desc: "Staff accounts, roles and project access", show: perms.manageUsers },
    { href: "/settings/company", icon: Building, title: "Company", desc: "Company details and default rates", show: perms.manageSettings },
  ].filter((i) => i.show);

  return (
    <>
      <PageHeader title="Settings" description="Payment plans, receipt numbering and branding are added in later phases." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ href, icon: Icon, title, desc }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full transition group-hover:ring-2 group-hover:ring-ring/40">
              <CardHeader>
                <Icon className="mb-2 size-5 text-muted-foreground" />
                <CardTitle>{title}</CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
