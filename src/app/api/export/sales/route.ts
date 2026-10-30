import type { NextRequest } from "next/server";
import { listSalesAll } from "@/features/sales/queries";
import { csvResponse, toCsv } from "@/lib/csv";
import { formatDate, todayPK } from "@/lib/dates";
import { SALE_STATUS_LABELS } from "@/features/sales/schemas";

/** Sales register (RLS applies — agents export only their own sales). */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const rows = await listSalesAll({
    q: sp.get("q") ?? undefined,
    projectId: sp.get("project") ?? undefined,
    status: (sp.get("status") as never) ?? undefined,
    page: 1,
    size: 100,
    sort: "booking_date",
    dir: "desc",
  });

  const csv = toCsv(
    ["Booking Form No", "Project", "Unit", "Block/Tower", "Street", "Floor", "Booked On", "Buyer", "CNIC", "Phone",
     "Buyers", "List Price (PKR)", "Discount (PKR)", "Sale Price (PKR)", "Received (PKR)", "Balance (PKR)",
     "Overdue (PKR)", "% Paid", "Next Due", "Status", "Cancellation Due", "Agent"],
    rows.map((s) => [
      s.booking_form_no, s.project_name, s.unit_no, s.block_name, s.street, s.floor_label,
      formatDate(s.booking_date), s.primary_client_name, s.primary_client_cnic, s.primary_client_phone,
      s.buyer_count, Number(s.final_price ?? 0) + Number(s.discount ?? 0), Number(s.discount ?? 0),
      Number(s.final_price ?? 0), Number(s.total_paid ?? 0), Number(s.balance ?? 0), Number(s.overdue_amount ?? 0),
      Number(s.pct_paid ?? 0), s.next_due_date ? formatDate(s.next_due_date) : null,
      s.status ? SALE_STATUS_LABELS[s.status] : null, s.cancellation_due ? "Yes" : "No", s.agent_name,
    ]),
  );
  return csvResponse(`sales-register-${todayPK()}.csv`, csv);
}
