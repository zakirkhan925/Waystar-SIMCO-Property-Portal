"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/labels";
import { Brand } from "./brand";
import { navFor } from "./nav";

function NavLinks({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {navFor(role).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DesktopSidebar({ role }: { role: AppRole }) {
  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar px-3 py-4 lg:flex">
      <Link href="/dashboard" className="px-2">
        <Brand />
      </Link>
      <NavLinks role={role} />
    </aside>
  );
}

export function MobileNav({ role }: { role: AppRole }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 px-3">
        <SheetHeader className="px-2">
          <SheetTitle asChild>
            <div>
              <Brand />
            </div>
          </SheetTitle>
        </SheetHeader>
        <NavLinks role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
