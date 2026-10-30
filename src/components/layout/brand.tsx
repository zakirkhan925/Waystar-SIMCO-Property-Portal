import { cn } from "@/lib/utils";

/**
 * The Waystar Royco wordmark, set the way the office signage is: a "WR" monogram,
 * then "Waystar" in the sans and "ROYCO" in the serif, divided by a hairline rule.
 * It inherits its colour, so it works on the graphite sidebar and on a white page.
 */
export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-md border border-current/25 font-display text-[15px] leading-none tracking-[0.08em]"
      >
        WR
      </span>
      {!compact && (
        <span className="flex items-baseline gap-1.5 leading-none">
          <span className="text-[15px] font-medium tracking-tight">Waystar</span>
          <span aria-hidden className="h-4 w-px self-center bg-current/40" />
          <span className="font-display text-[15px] tracking-[0.14em]">ROYCO</span>
        </span>
      )}
      <span className="sr-only">Waystar Royco</span>
    </div>
  );
}
