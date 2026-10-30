import { Brand } from "@/components/layout/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      {/* the office signage, dimmed, behind the sign-in card */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[url('/brand/waystar-royco-signage.jpg')] bg-cover bg-center opacity-15 dark:opacity-10"
      />
      <div aria-hidden className="absolute inset-0 bg-background/70" />
      <div className="relative w-full max-w-sm space-y-6">
        <Brand className="justify-center" />
        {children}
        <p className="text-center text-xs text-muted-foreground">
          Waystar Royco Marketing — exclusive marketing partner of SIMCO Developers
        </p>
      </div>
    </main>
  );
}
