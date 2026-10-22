"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UNIT_STATUS_LABELS, type UnitStatus } from "@/lib/labels";

// Same hues as the inventory grid so a status reads the same colour everywhere.
const COLORS: Record<UnitStatus, string> = {
  available: "#10b981",
  on_hold: "#f59e0b",
  booked: "#0ea5e9",
  sold: "#f43f5e",
  rented: "#8b5cf6",
  blocked: "#71717a",
};
const ORDER: UnitStatus[] = ["sold", "booked", "rented", "on_hold", "blocked", "available"];

export type StatusRow = { code: string; name: string } & Record<UnitStatus, number>;

export function StatusByProjectChart({ data }: { data: StatusRow[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
          <XAxis dataKey="code" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
            labelFormatter={(code) => data.find((d) => d.code === code)?.name ?? code}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {ORDER.map((s) => (
            <Bar key={s} dataKey={s} name={UNIT_STATUS_LABELS[s]} stackId="a" fill={COLORS[s]} maxBarSize={48} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
