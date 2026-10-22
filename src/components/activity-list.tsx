import { formatDateTime } from "@/lib/dates";
import type { ActivityRow } from "@/features/units/queries";

const HIDDEN = new Set(["updated_at", "created_at", "created_by", "id", "area_sqft"]);

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export function ActivityList({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  return (
    <ol className="space-y-4">
      {rows.map((r) => {
        const oldD = (r.old_data ?? {}) as Record<string, unknown>;
        const newD = (r.new_data ?? {}) as Record<string, unknown>;
        const fields = (r.changed_fields ?? []).filter((f) => !HIDDEN.has(f));
        return (
          <li key={r.id} className="border-l-2 pl-4">
            <div className="text-sm">
              <span className="font-medium">{r.changed_by_name}</span>{" "}
              <span className="text-muted-foreground">
                {r.action === "insert" ? "created this record" : r.action === "delete" ? "deleted this record" : "updated"}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(r.changed_at)}</span>
            </div>
            {r.action === "update" && fields.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {fields.map((f) => (
                  <li key={f}>
                    <span className="text-muted-foreground">{f.replace(/_/g, " ")}:</span> {show(oldD[f])} → <strong>{show(newD[f])}</strong>
                  </li>
                ))}
              </ul>
            )}
            {r.reason && <p className="mt-1 text-xs italic text-muted-foreground">Reason: {r.reason}</p>}
          </li>
        );
      })}
    </ol>
  );
}
