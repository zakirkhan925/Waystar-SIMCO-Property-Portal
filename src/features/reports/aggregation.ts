import { PAYMENT_STATUS_LABELS, paymentStatus } from "@/features/payments/filters";
import { PAYMENT_MODE_LABELS } from "@/features/sales/schemas";
import { toDecimal, type MoneyInput } from "@/lib/money";
import { Constants, type Enums } from "@/types/database";

type Project = { id: string; name: string };
type ProjectRow = { project_id: string };

export const inventoryStatuses = Constants.public.Enums.unit_status;

export function aggregateProjectReports(projects: Project[], records: {
  units: (ProjectRow & { status: Enums<"unit_status">; base_price: MoneyInput })[];
  sales: (ProjectRow & { final_price: MoneyInput })[];
  cancellations: ProjectRow[];
  transfers: ProjectRow[];
}) {
  const groups = new Map(projects.map(({ id, name }) => [id, {
    name, units: 0, inventory: { available: 0, on_hold: 0, booked: 0, sold: 0, rented: 0, blocked: 0 },
    listValue: toDecimal(0), bookings: 0, saleValue: toDecimal(0), cancellations: 0, transfers: 0,
  }]));
  for (const unit of records.units) {
    const group = groups.get(unit.project_id);
    if (!group) continue;
    group.units += 1;
    group.inventory[unit.status] += 1;
    if (unit.status === "available") group.listValue = group.listValue.plus(toDecimal(unit.base_price));
  }
  for (const sale of records.sales) {
    const group = groups.get(sale.project_id);
    if (!group) continue;
    group.bookings += 1;
    group.saleValue = group.saleValue.plus(toDecimal(sale.final_price));
  }
  for (const row of records.cancellations) {
    const group = groups.get(row.project_id);
    if (group) group.cancellations += 1;
  }
  for (const row of records.transfers) {
    const group = groups.get(row.project_id);
    if (group) group.transfers += 1;
  }
  return [...groups.values()];
}

type ReportPayment = ProjectRow & Parameters<typeof paymentStatus>[0] & {
  mode: Enums<"payment_mode">;
  amount: MoneyInput;
};
const emptyTotal = (name: string) => ({ name, count: 0, amount: toDecimal(0) });

function addAmount(total: ReturnType<typeof emptyTotal>, amount: MoneyInput) {
  total.count += 1;
  total.amount = total.amount.plus(toDecimal(amount));
}

export function aggregateCollections(projects: Project[], payments: ReportPayment[]) {
  const statuses = {
    cleared: emptyTotal(PAYMENT_STATUS_LABELS.cleared),
    pending: emptyTotal(PAYMENT_STATUS_LABELS.pending),
    bounced: emptyTotal(PAYMENT_STATUS_LABELS.bounced),
    reversed: emptyTotal(PAYMENT_STATUS_LABELS.reversed),
  };
  const byProject = new Map(projects.map(({ id, name }) => [id, emptyTotal(name)]));
  const byMode = new Map(Object.entries(PAYMENT_MODE_LABELS).map(([mode, name]) => [mode, emptyTotal(name)]));
  for (const payment of payments) {
    const status = paymentStatus(payment);
    addAmount(statuses[status], payment.amount);
    if (status !== "cleared") continue;
    const project = byProject.get(payment.project_id);
    const mode = byMode.get(payment.mode);
    if (project) addAmount(project, payment.amount);
    if (mode) addAmount(mode, payment.amount);
  }
  return { statuses, byProject: [...byProject.values()], byMode: [...byMode.values()] };
}

export function aggregateRefunds(refunds: { refund_status: Enums<"refund_status">; refund_due: MoneyInput }[]) {
  const totals = {
    pending_resale: emptyTotal("Pending re-sale"),
    payable: emptyTotal("Payable"),
    paid: emptyTotal("Paid in the period"),
  };
  for (const refund of refunds) {
    if (refund.refund_status !== "waived") addAmount(totals[refund.refund_status], refund.refund_due);
  }
  return Object.values(totals);
}
