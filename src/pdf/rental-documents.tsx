import { Document, Text, View } from "@react-pdf/renderer";
import { differenceInCalendarMonths, parseISO } from "date-fns";
import type { Lease } from "@/features/rentals/queries";
import { LEASE_STATUS_LABELS, paymentModeLabels, rentSchedule } from "@/features/rentals/terms";
import { formatDate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import type { Tables } from "@/types/database";
import { DocHead, DocPage, Particulars, RefRow, Signatures, TitleBlock, pdfSafe, s } from "./components";
import type { DocPageContext } from "./types";

export const RENTAL_COMPANY = "Waystar Royco Marketing Pvt Ltd";

export type RentalDocument =
  | { type: "lease_agreement" }
  | { type: "rent_invoice"; invoice: Tables<"v_rent_invoice_balances"> }
  | { type: "rent_receipt"; payment: Tables<"v_rent_payment_totals"> }
  | { type: "owner_statement"; ledger: Tables<"v_lease_ledger">; payouts: Tables<"owner_payouts">[] };

function RentalTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <View>
      <Text minPresenceAhead={36} style={s.heading}>{title}</Text>
      <View style={s.table}>
        <View wrap={false} style={[s.tr, { backgroundColor: "#f3f4f6" }]}>
          {headers.map((heading) => <Text key={heading} style={[s.bold, { flex: 1, padding: 3 }]}>{heading}</Text>)}
        </View>
        {rows.map((row, index) => (
          <View wrap={false} key={index} style={index === rows.length - 1 ? s.trLast : s.tr}>
            {row.map((value, column) => <Text key={column} style={{ flex: 1, padding: 3 }}>{pdfSafe(value)}</Text>)}
          </View>
        ))}
      </View>
    </View>
  );
}

function LeaseTerms({ lease, compact }: { lease: Lease; compact: boolean }) {
  const months = differenceInCalendarMonths(parseISO(lease.end_date), parseISO(lease.start_date)) + 1;
  const schedule = rentSchedule(lease.start_date, lease.monthly_rent, lease.increment_pct, months);
  const years = schedule.flatMap((month, index) => index % 12 ? [] : [[String(index / 12 + 1), formatDate(month.period), formatPKR(month.rent)]]);
  return (
    <>
      <Particulars compact={compact} heading="LEASE TERMS" rows={[
        ["Start date", formatDate(lease.start_date)], ["End date", formatDate(lease.end_date)],
        ["Status", LEASE_STATUS_LABELS[lease.status]], ["Starting monthly rent", formatPKR(schedule[0]?.rent ?? lease.monthly_rent)],
        ["Rent due day", `Day ${lease.rent_due_day} of each month`], ["Yearly increase", `${lease.increment_pct}%`],
        ["Agreed security deposit", formatPKR(lease.security_deposit)],
      ]} />
      <RentalTable title="YEARLY RENT SCHEDULE" headers={["Lease year", "First billing month", "Monthly rent (PKR)"]} rows={years} />
      <Signatures compact={compact} labels={[`Authorised Signatory — ${RENTAL_COMPANY}`, "Landlord", "Tenant"]} />
    </>
  );
}

export function RentalDocumentPdf({ ctx, lease, document }: {
  ctx: DocPageContext; lease: Lease; document: RentalDocument;
}) {
  const compact = ctx.layout.mode !== "plain";
  const landlord = lease.landlord_client_id ? lease.landlord_name : "SIMCO";

  return (
    <Document title={`${ctx.template.title} ${ctx.refNo}`} author={RENTAL_COMPANY} creator="Waystar Property Portal">
      <DocPage ctx={ctx}>
        <DocHead ctx={ctx}>
          <TitleBlock ctx={ctx} subtitle={RENTAL_COMPANY} />
          <RefRow ctx={ctx} />
        </DocHead>
        <Particulars compact={compact} heading="PARTIES AND PROPERTY" rows={[
          ["Tenant", lease.tenant_name], ["Landlord", landlord], ["Project", ctx.project.displayName],
          ["Unit", lease.units?.unit_no],
          ...(document.type === "lease_agreement" ? [] : [["Lease agreement", lease.agreement_no] as [string, string]]),
        ]} />

        {document.type === "lease_agreement" && <LeaseTerms lease={lease} compact={compact} />}

        {document.type === "rent_invoice" && <Particulars compact={compact} heading="RENT INVOICE" rows={[
          ["Billing period", formatDate(document.invoice.period)], ["Due on", formatDate(document.invoice.due_date)],
          ["Rent", formatPKR(document.invoice.rent_amount)], ["Late penalty", formatPKR(document.invoice.late_fee)],
          ["Waived", formatPKR(document.invoice.waived_amount)], ["Total billed", formatPKR(document.invoice.amount_due)],
          ["Paid", formatPKR(document.invoice.amount_paid)], ["Outstanding", formatPKR(document.invoice.outstanding)],
        ]} />}

        {document.type === "rent_receipt" && <Particulars compact={compact} heading="PAYMENT DETAILS" rows={[
          ["Amount received", formatPKR(document.payment.amount)], ["Received on", formatDate(document.payment.received_on)],
          ["Payment mode", document.payment.mode ? paymentModeLabels[document.payment.mode] : null],
          ...(document.payment.bank_name ? [["Bank", document.payment.bank_name] as [string, string]] : []),
          ...(document.payment.instrument_no ? [["Instrument no.", document.payment.instrument_no] as [string, string]] : []),
          ...(document.payment.instrument_date ? [["Instrument date", formatDate(document.payment.instrument_date)] as [string, string]] : []),
          ["Status", document.payment.status === "reversed" ? "Reversed"
            : document.payment.instrument_status === "bounced" ? "Bounced"
            : document.payment.instrument_status === "pending" ? "Pending clearance" : "Cleared"],
        ]} />}

        {document.type === "owner_statement" && <>
          <Particulars compact={compact} heading="OWNER BALANCE" rows={[
            ["Rent collected", formatPKR(document.ledger.rent_collected)],
            ["Waystar commission", formatPKR(document.ledger.commission_earned)],
            ["Paid out", formatPKR(document.ledger.paid_out)],
            ["Balance owed", formatPKR(document.ledger.owed_to_landlord)],
          ]} />
          <RentalTable title="PAYOUTS" headers={["Paid on", "Mode", "Reference", "Amount (PKR)", "Status"]}
            rows={document.payouts.length ? document.payouts.map((payout) => [
              formatDate(payout.paid_on), paymentModeLabels[payout.mode], payout.reference_no,
              formatPKR(payout.amount), payout.status === "reversed" ? "Reversed" : "Paid",
            ]) : [["No payouts recorded", "", "", "", ""]]} />
        </>}
      </DocPage>
    </Document>
  );
}
