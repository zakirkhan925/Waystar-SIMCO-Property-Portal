import { cn } from "@/lib/utils";

/** Text wordmark until the official Waystar logo is uploaded in Settings. */
export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        W
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-semibold">Waystar Portal</div>
          <div className="text-xs text-muted-foreground">SIMCO Developers</div>
        </div>
      )}
    </div>
  );
}
