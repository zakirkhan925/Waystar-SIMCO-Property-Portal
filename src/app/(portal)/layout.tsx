import { DesktopSidebar, MobileNav } from "@/components/layout/app-sidebar";
import { GlobalSearch } from "@/components/layout/global-search";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { getCurrentUser } from "@/lib/auth/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-dvh">
      <DesktopSidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <MobileNav role={user.role} />
          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>
          <ThemeToggle />
          <UserMenu name={user.fullName} email={user.email} role={user.role} />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
