import type { NextRequest } from "next/server";
import { PAYMENT_STATUS_LABELS, PAYMENTS_ROLES, parsePaymentFilters, paymentStatus } from "@/features/payments/filters";
import { listPaymentsAll } from "@/features/payments/queries";
import { PAYMENT_MODE_LABELS } from "@/features/sales/schemas";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { csvResponse, toCsv } from "@/lib/csv";
import { formatDate, todayPK } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!hasRole(user, ...PAYMENTS_ROLES)) return new Response("Access denied.", { status: 403 });

  const rows = await listPaymentsAll(parsePaymentFilters(Object.fromEntries(request.nextUrl.searchParams)));
  const csv = toCsv(
    ["Received On", "Receipt No", "Buyer", "Project", "Plot", "Mode", "Bank", "Instrument No", "Instrument Date", "Amount (PKR)", "Status"],
    rows.map((payment) => [
      formatDate(payment.received_on), payment.receipt_no, payment.buyer, payment.project, payment.plot,
      PAYMENT_MODE_LABELS[payment.mode], payment.bank_name, payment.instrument_no,
      payment.instrument_date ? formatDate(payment.instrument_date) : null,
      payment.amount, PAYMENT_STATUS_LABELS[paymentStatus(payment)],
    ]),
  );
  return csvResponse(`payments-register-${todayPK()}.csv`, csv);
}
