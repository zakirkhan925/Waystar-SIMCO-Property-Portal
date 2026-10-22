import { Brand } from "@/components/layout/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <Brand className="justify-center" />
        {children}
        <p className="text-center text-xs text-muted-foreground">
          Waystar Royco Marketing — exclusive marketing partner of SIMCO Developers
        </p>
      </div>
    </main>
  );
}
