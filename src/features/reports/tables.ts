import type Decimal from "decimal.js";
import { inventoryStatuses } from "./aggregation";
import type { loadReports } from "./queries";

type ReportCell = string | number | Decimal;
type ReportTable = { id: string; title: string; headers: string[]; rows: ReportCell[][] };

const inventoryLabels = {
  available: "Available", on_hold: "On hold", booked: "Booked", sold: "Sold", rented: "Rented", blocked: "Blocked",
};

export function reportTables({ projects, collections, recoveries, refunds }: Awaited<ReturnType<typeof loadReports>>): ReportTable[] {
  const totalsRows = (totals: { name: string; count: number; amount: Decimal }[]) =>
    totals.map(({ name, count, amount }) => [name, count, amount]);

  return [
    {
      id: "inventory", title: "Inventory by project",
      headers: ["Project", "Total units", ...inventoryStatuses.map((status) => inventoryLabels[status]), "Available list value (PKR)"],
      rows: projects.map((row) => [
        row.name, row.units, ...inventoryStatuses.map((status) => row.inventory[status]), row.listValue,
      ]),
    },
    {
      id: "sales", title: "Sales in the period",
      headers: ["Project", "Bookings", "Sale value (PKR)", "Cancellations", "Transfers"],
      rows: projects.map((row) => [row.name, row.bookings, row.saleValue, row.cancellations, row.transfers]),
    },
    {
      id: "collection-status", title: "Collections by status in the period",
      headers: ["Status", "Payments", "Amount (PKR)"],
      rows: totalsRows(Object.values(collections.statuses)),
    },
    {
      id: "collection-project", title: "Cleared collections by project",
      headers: ["Project", "Payments", "Amount (PKR)"],
      rows: totalsRows(collections.byProject),
    },
    {
      id: "collection-mode", title: "Cleared collections by payment mode",
      headers: ["Payment mode", "Payments", "Amount (PKR)"],
      rows: totalsRows(collections.byMode),
    },
    {
      id: "receivables", title: "Receivables as of today",
      headers: ["Receivables", "Amount (PKR)"],
      rows: [
        ["Total outstanding", recoveries.outstanding],
        ["Overdue", recoveries.overdue],
        ["Not yet due", recoveries.totals.not_due],
        ["0–30 days overdue", recoveries.totals["0_30"]],
        ["31–60 days overdue", recoveries.totals["31_60"]],
        ["61–90 days overdue", recoveries.totals["61_90"]],
        ["90+ days overdue", recoveries.totals["90_plus"]],
        ["Late charges outstanding", recoveries.lateCharges],
      ],
    },
    {
      id: "refunds", title: "Refunds",
      headers: ["Status", "Cancellations", "Amount (PKR)"],
      rows: totalsRows(refunds),
    },
  ];
}
