import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatPKRShort } from "@/lib/money";
import { UNIT_STATUS_LABELS, UNIT_STATUS_STYLES } from "@/lib/labels";
import type { UnitListRow } from "./queries";

type Group = { key: string; title: string; rows: { key: string; label: string; units: UnitListRow[] }[] };

/** Group plots by block → street, and high-rise units by tower → floor (top floor first, like a building). */
function groupUnits(units: UnitListRow[], isPlotSociety: boolean): Group[] {
  const byBlock = new Map<string, Group>();
  for (const u of units) {
    const bKey = u.block_id ?? "none";
    const g = byBlock.get(bKey) ?? { key: bKey, title: u.blocks?.name ?? "Unassigned", rows: [] };
    byBlock.set(bKey, g);
    const rKey = isPlotSociety ? (u.street ?? "—") : (u.floor_id ?? "none");
    let row = g.rows.find((r) => r.key === rKey);
    if (!row) {
      row = { key: rKey, label: isPlotSociety ? (u.street ?? "No street") : (u.floors?.label ?? "No floor"), units: [] };
      g.rows.push(row);
    }
    row.units.push(u);
  }
  const groups = [...byBlock.values()].sort((a, b) => a.title.localeCompare(b.title, "en", { numeric: true }));
  for (const g of groups) {
    if (isPlotSociety) g.rows.sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
    else g.rows.sort((a, b) => (b.units[0]?.floors?.level ?? 0) - (a.units[0]?.floors?.level ?? 0));
    for (const r of g.rows) r.units.sort((a, b) => a.unit_no.localeCompare(b.unit_no, "en", { numeric: true }));
  }
  return groups;
}

export function UnitGrid({ units, isPlotSociety }: { units: UnitListRow[]; isPlotSociety: boolean }) {
  if (units.length === 0) {
    return <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No units match these filters.</p>;
  }
  const groups = groupUnits(units, isPlotSociety);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key} className="rounded-lg border">
          <h2 className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">{g.title}</h2>
          <div className="divide-y">
            {g.rows.map((r) => (
              <div key={r.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                <div className="w-28 shrink-0 pt-1 text-xs font-medium text-muted-foreground">{r.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {r.units.map((u) => (
                    <Link
                      key={u.id}
                      href={`/units/${u.id}`}
                      title={`${u.unit_no} · ${UNIT_STATUS_LABELS[u.status]} · ${Number(u.area_sqft).toLocaleString("en-PK")} sq ft · ${formatPKRShort(u.base_price)}`}
                      className={cn(
                        "flex min-w-16 flex-col items-center rounded-md border px-2 py-1 text-center transition hover:ring-2 hover:ring-ring/50 focus-visible:ring-2 focus-visible:ring-ring",
                        UNIT_STATUS_STYLES[u.status],
                      )}
                    >
                      <span className="text-xs font-semibold">{u.unit_no}</span>
                      <span className="text-[10px] opacity-80">
                        {u.size_unit === "sqft" ? `${Number(u.size_value)} ft²` : `${Number(u.size_value)} ${u.size_unit === "marla" ? "M" : "K"}`}
                        {u.is_corner ? " · C" : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
