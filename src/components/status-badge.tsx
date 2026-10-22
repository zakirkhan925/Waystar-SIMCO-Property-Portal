import { cn } from "@/lib/utils";
import { UNIT_STATUS_LABELS, UNIT_STATUS_STYLES, type UnitStatus } from "@/lib/labels";

export function UnitStatusBadge({ status, className }: { status: UnitStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        UNIT_STATUS_STYLES[status],
        className,
      )}
    >
      {UNIT_STATUS_LABELS[status]}
    </span>
  );
}

export function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(UNIT_STATUS_LABELS) as UnitStatus[]).map((s) => (
        <UnitStatusBadge key={s} status={s} />
      ))}
    </div>
  );
}
