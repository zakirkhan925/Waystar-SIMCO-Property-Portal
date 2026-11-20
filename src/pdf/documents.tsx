import { Document, Text, View } from "@react-pdf/renderer";
import Decimal from "decimal.js";
import { rupeesInWords } from "@/lib/amount-words";
import { formatDate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { DocHead, DocPage, Particulars, pdfSafe, RefRow, s, Sections, Signatures, TitleBlock } from "./components";
import { BLANK } from "./template";
import type { DocContext, Party } from "./types";

const pkr = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? null : `PKR ${formatPKR(v).replace(/^Rs /, "")}`);
const d = (v: string | null | undefined) => (v ? formatDate(v) : null);

/** Values available to {{placeholders}} in every template. */
export function templateVars(ctx: DocContext): Record<string, string | null | undefined> {
  const a = ctx.applicant;
  return {
    ...ctx.settings,
    project_name: ctx.project.displayName,
    project_address: ctx.project.fullAddress,
    plot_no: ctx.plot.no,
    booking_date: d(ctx.sale.bookingDate),
    agreement_date: d(ctx.sale.agreementDate ?? ctx.date),
    allotment_ref: ctx.sale.allotmentRef,
    allotment_date: d(ctx.sale.allotmentDate),
    total_price: pkr(ctx.sale.totalPrice),
    total_price_words: rupeesInWords(ctx.sale.totalPrice),
    purchaser_name: a.name,
    purchaser_relation: a.relation ?? "S/O / D/O / W/O",
    purchaser_guardian: a.guardian,
    purchaser_cnic: a.cnic ?? a.passport,
    purchaser_address: a.address,
    dues_cleared_date: d(ctx.sale.duesClearedDate),
    ndc_purpose: ctx.ndcPurpose,
  };
}

const plotCategory = (ctx: DocContext) => (ctx.plot.category === "Corner" ? "Corner (+10%)" : "Standard");
const addressee = (p: Party) => (
  <View style={{ marginBottom: 8 }}>
    <Text>To,</Text>
    <Text style={s.bold}>{pdfSafe(p.name)}</Text>
    <Text>{pdfSafe(p.address ?? BLANK)}</Text>
  </View>
);

// ---------------------------------------------------------------- Booking Form
function BookingForm({ ctx }: { ctx: DocContext }) {
  const vars = templateVars(ctx);
  const compact = ctx.layout.mode !== "plain";
  const a = ctx.applicant;
  const joint = ctx.jointApplicants[0];
  const inst = ctx.sale.planType === "installment";
  return (
    <DocPage ctx={ctx}>
      <DocHead ctx={ctx}>
        <TitleBlock ctx={ctx} />
        <RefRow ctx={ctx} label="Form No." />
      </DocHead>
      <Particulars
        compact={compact}
        heading="PROJECT & PLOT DETAILS"
        rows={[
          ["Project Name", [ctx.project.displayName, ctx.project.fullAddress].filter(Boolean).join(", ")],
          ["Plot No.", [ctx.plot.no, ctx.plot.block, ctx.plot.street].filter(Boolean).join(" · ")],
          ["Plot Category", plotCategory(ctx)],
          ["Plot Type & Size", ctx.plot.sizeLabel],
          ["Total Sale Price", pkr(ctx.sale.totalPrice)],
        ]}
      />
      <Particulars
        compact={compact}
        heading="APPLICANT DETAILS"
        rows={[
          ["Applicant Name", a.name],
          ["Father's / Husband's Name", [a.relation, a.guardian].filter(Boolean).join(" ")],
          ["CNIC No.", a.cnic ?? (a.passport ? `Passport ${a.passport}` : null)],
          ["Nationality", a.nationality],
          ["Mailing Address", a.address],
          ["Contact No. / Email", [a.phone, a.email].filter(Boolean).join(" / ")],
        ]}
      />
      <Particulars
        compact={compact}
        heading="JOINT APPLICANT / NOMINEE (IF ANY)"
        rows={[
          ["Name", joint?.name ?? "—"],
          ["CNIC No.", joint ? (joint.cnic ?? joint.passport) : "—"],
          ["Relationship to Applicant", joint ? joint.relationship : "—"],
        ]}
      />
      <Particulars
        compact={compact}
        heading="PAYMENT PLAN SELECTED"
        rows={[
          ["Plan Type", inst ? "Down Payment + Installments" : "Full Payment"],
          ["Booking Amount Paid", pkr(ctx.sale.bookingAmount)],
          ["Down Payment (%)", inst ? (ctx.sale.downPaymentPct ? `${Number(ctx.sale.downPaymentPct)} %` : null) : "—"],
          ["No. of Installments", inst ? `${ctx.sale.installmentCount ?? BLANK} (${ctx.sale.frequencyLabel ?? BLANK})` : "—"],
          ["Payment Mode", `${ctx.sale.paymentMode ?? "Cheque / Bank Transfer / Pay Order"} — Instrument No. ${ctx.sale.instrumentNo ?? BLANK}`],
        ]}
      />
      <Sections sections={ctx.template.sections} vars={vars} />
      <Signatures compact={compact} labels={["Applicant Signature", "Joint Applicant Signature", "Received By (For SIMCO Developers)"]} />
    </DocPage>
  );
}

// ---------------------------------------------------------------- Allotment Letter
function AllotmentLetter({ ctx }: { ctx: DocContext }) {
  const vars = templateVars(ctx);
  const compact = ctx.layout.mode !== "plain";
  const balance = new Decimal(ctx.sale.totalPrice).minus(ctx.sale.amountPaid).toFixed(2);
  return (
    <DocPage ctx={ctx}>
      <DocHead ctx={ctx}>
        <TitleBlock ctx={ctx} />
        <RefRow ctx={ctx} />
        {addressee(ctx.applicant)}
        <Text style={[s.bold, { marginBottom: 6 }]}>Subject: Allotment of Plot — {pdfSafe(ctx.project.displayName)}</Text>
      </DocHead>
      <Sections sections={ctx.template.sections} vars={vars} only={["intro"]} />
      <Particulars
        compact={compact}
        heading="ALLOTMENT PARTICULARS"
        rows={[
          ["Project Name", ctx.project.displayName],
          ["Plot No.", ctx.plot.no],
          ["Plot Type & Size", ctx.plot.sizeLabel],
          ["Total Sale Price", pkr(ctx.sale.totalPrice)],
          ["Amount Paid to Date", pkr(ctx.sale.amountPaid)],
          ["Balance Payable", pkr(balance)],
        ]}
      />
      <Sections sections={ctx.template.sections} vars={vars} except={["intro"]} />
      <Signatures
        compact={compact}
        labels={[`MANAGING DIRECTOR\n${ctx.settings.managing_director_name ?? BLANK}`, `ALLOTTEE\n${ctx.applicant.name}`]}
      />
    </DocPage>
  );
}

// ---------------------------------------------------------------- Sale Agreement
function SaleAgreement({ ctx }: { ctx: DocContext }) {
  const vars = templateVars(ctx);
  const compact = ctx.layout.mode !== "plain";
  return (
    <DocPage ctx={ctx}>
      <DocHead ctx={ctx}>
        <TitleBlock ctx={ctx} />
        <RefRow ctx={ctx} />
      </DocHead>
      <Sections sections={ctx.template.sections} vars={vars} only={["parties", "recitals"]} />
      <Particulars
        compact={compact}
        heading="PLOT PARTICULARS"
        rows={[
          ["Project Name", [ctx.project.displayName, ctx.project.fullAddress].filter(Boolean).join(", ")],
          ["Plot No.", ctx.plot.no],
          ["Plot Category", plotCategory(ctx)],
          ["Plot Type & Size", ctx.plot.sizeLabel],
          ["Total Sale Price", pkr(ctx.sale.totalPrice)],
        ]}
      />
      <Sections sections={ctx.template.sections} vars={vars} except={["parties", "recitals"]} />
      <Signatures compact={compact} labels={["Seller — For SIMCO Developers", "Purchaser"]} />
      <Signatures compact={compact} labels={["Witness 1 (Name, CNIC, Signature)", "Witness 2 (Name, CNIC, Signature)"]} />
    </DocPage>
  );
}

// ---------------------------------------------------------------- Installment Payment Schedule
function InstallmentSchedule({ ctx }: { ctx: DocContext }) {
  const vars = templateVars(ctx);
  const compact = ctx.layout.mode !== "plain";
  const total = ctx.schedule.reduce((acc, r) => acc.plus(r.amount), new Decimal(0));
  const pctTotal = ctx.schedule.reduce((acc, r) => acc.plus(r.pct ?? 0), new Decimal(0));
  const cols = [
    { h: "#", w: "5%" },
    { h: "Milestone / Installment", w: "27%" },
    { h: "Due Date", w: "13%" },
    { h: "% of Price", w: "9%" },
    { h: "Amount (PKR)", w: "16%" },
    { h: "Paid Date", w: "13%" },
    { h: "Received By", w: "17%" },
  ];
  const cell = (w: string, bold = false, align: "left" | "right" | "center" = "left") => ({
    width: w,
    paddingVertical: compact ? 1.5 : 2,
    paddingHorizontal: 3,
    borderRightWidth: 0.75,
    borderRightColor: "#9ca3af",
    textAlign: align,
    fontFamily: bold ? "Helvetica-Bold" : "Helvetica",
  });
  return (
    <DocPage ctx={ctx}>
      <DocHead ctx={ctx}>
        <TitleBlock ctx={ctx} subtitle="Annexure to Booking Form / Sale Agreement" />
      </DocHead>
      <Particulars
        compact={compact}
        heading="REFERENCE DETAILS"
        rows={[
          ["Project Name", [ctx.project.displayName, ctx.project.fullAddress].filter(Boolean).join(", ")],
          ["Plot No.", `${ctx.plot.no}     Plot Size: ${ctx.plot.sizeLabel}     Category: ${ctx.plot.category}`],
          ["Applicant Name", ctx.applicant.name],
          ["Total Sale Price", pkr(ctx.sale.totalPrice)],
          ["Agreement / Booking Ref.", `${ctx.sale.agreementRef ?? `SA-${BLANK}`} / ${ctx.sale.bookingRef ?? `BF-${BLANK}`}`],
        ]}
      />
      <View style={[s.table, { marginTop: 6 }]}>
        <View style={[s.tr, { backgroundColor: "#f3f4f6" }]} fixed>
          {cols.map((c) => (
            <Text key={c.h} style={cell(c.w, true, c.h.startsWith("Amount") || c.h.startsWith("%") ? "right" : "left")}>
              {c.h}
            </Text>
          ))}
        </View>
        {ctx.schedule.map((r) => (
          <View key={r.no} style={s.tr} wrap={false}>
            <Text style={cell(cols[0].w)}>{r.no}</Text>
            <Text style={cell(cols[1].w)}>{r.label}</Text>
            <Text style={cell(cols[2].w)}>{r.dueDate ? formatDate(r.dueDate) : "On notice"}</Text>
            <Text style={cell(cols[3].w, false, "right")}>{r.pct ? `${Number(r.pct)}%` : ""}</Text>
            <Text style={cell(cols[4].w, false, "right")}>{formatPKR(r.amount).replace(/^Rs /, "")}</Text>
            <Text style={cell(cols[5].w)}>{r.paidDate ? formatDate(r.paidDate) : ""}</Text>
            <Text style={cell(cols[6].w)}>{r.receivedBy ?? ""}</Text>
          </View>
        ))}
        <View style={s.trLast}>
          <Text style={cell(cols[0].w)} />
          <Text style={cell(cols[1].w, true)}>Total</Text>
          <Text style={cell(cols[2].w)} />
          <Text style={cell(cols[3].w, true, "right")}>{`${pctTotal.toNumber()}%`}</Text>
          <Text style={cell(cols[4].w, true, "right")}>{formatPKR(total.toFixed(2)).replace(/^Rs /, "")}</Text>
          <Text style={cell(cols[5].w)} />
          <Text style={cell(cols[6].w)} />
        </View>
      </View>
      <Sections sections={ctx.template.sections} vars={vars} only={["note"]} />
      {/* closing terms stay with the signatures, so a signature row never sits alone on a page */}
      <View wrap={false}>
        <Sections sections={ctx.template.sections} vars={vars} except={["note"]} />
        <Signatures compact={compact} labels={["For SIMCO Developers", "Applicant"]} />
      </View>
    </DocPage>
  );
}

// ---------------------------------------------------------------- Possession Letter
function PossessionLetter({ ctx }: { ctx: DocContext }) {
  const vars = templateVars(ctx);
  const compact = ctx.layout.mode !== "plain";
  return (
    <DocPage ctx={ctx}>
      <DocHead ctx={ctx}>
        <TitleBlock ctx={ctx} />
        <RefRow ctx={ctx} />
        {addressee(ctx.applicant)}
        <Text style={[s.bold, { marginBottom: 6 }]}>
          Subject: Handing Over of Possession — {pdfSafe(ctx.project.displayName)}, Plot {ctx.plot.no}
        </Text>
      </DocHead>
      <Sections sections={ctx.template.sections} vars={vars} only={["intro"]} />
      <Particulars
        compact={compact}
        heading="PLOT PARTICULARS"
        rows={[
          ["Project Name", [ctx.project.displayName, ctx.project.fullAddress].filter(Boolean).join(", ")],
          ["Plot No.", ctx.plot.no],
          ["Plot Category", plotCategory(ctx)],
          ["Plot Size / Area", `${ctx.plot.sizeLabel} — ${Number(ctx.plot.areaSqft).toLocaleString("en-PK")} sq. ft.`],
          ["Date of Possession", d(ctx.sale.possessionDate)],
        ]}
      />
      <Sections sections={ctx.template.sections} vars={vars} except={["intro"]} />
      <Signatures compact={compact} labels={["For SIMCO Developers", "Acknowledged by Allottee"]} />
    </DocPage>
  );
}

// ---------------------------------------------------------------- NDC
function NdcLetter({ ctx }: { ctx: DocContext }) {
  const vars = templateVars(ctx);
  const compact = ctx.layout.mode !== "plain";
  return (
    <DocPage ctx={ctx}>
      <DocHead ctx={ctx}>
        <TitleBlock ctx={ctx} />
        <RefRow ctx={ctx} />
      </DocHead>
      <Sections sections={ctx.template.sections} vars={vars} only={["intro"]} />
      <Particulars
        compact={compact}
        heading="PLOT & ALLOTTEE PARTICULARS"
        rows={[
          ["Project Name", ctx.project.displayName],
          ["Plot No.", ctx.plot.no],
          ["Allottee Name", ctx.applicant.name],
          ["CNIC No.", ctx.applicant.cnic ?? ctx.applicant.passport],
          ["Total Sale Price", pkr(ctx.sale.totalPrice)],
          ["Total Amount Received", pkr(ctx.sale.amountPaid)],
          ["Date of Last Payment", d(ctx.sale.lastPaymentDate)],
        ]}
      />
      <Sections sections={ctx.template.sections} vars={vars} except={["intro"]} />
      <Signatures compact={compact} labels={["For SIMCO Developers (Finance / Accounts)", "Company Stamp"]} />
    </DocPage>
  );
}

function StatementTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <View>
      <View wrap={false} minPresenceAhead={24}>
        <Text style={s.heading}>{title}</Text>
        <View style={s.tr}>
          {columns.map((column) => (
            <Text key={column} style={[s.bold, { flex: 1, padding: 3, fontSize: 8 }]}>{column}</Text>
          ))}
        </View>
      </View>
      {rows.length === 0 && <Text style={s.para}>No records.</Text>}
      {rows.map((row, index) => (
        <View key={index} style={s.tr} wrap={false}>
          {row.map((cell, i) => (
            <Text key={i} style={{ flex: 1, padding: 3, fontSize: 8 }}>{pdfSafe(cell)}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const letterSignatories = [
  "Authorised Signatory — Waystar Royco Marketing Pvt Ltd",
  "For SIMCO Developers",
];

function ownerRows(owners: Party[], label: string): [string, string][] {
  return owners.map((owner) => [label, `${owner.name} (CNIC ${owner.cnic ?? "not recorded"})`]);
}

function TransferLetter({ ctx }: { ctx: DocContext }) {
  const transfer = ctx.transfer;
  if (!transfer) throw new Error("Transfer data is required.");
  const compact = ctx.layout.mode !== "plain";

  return (
    <DocPage ctx={ctx}>
      <DocHead ctx={ctx}>
        <TitleBlock ctx={ctx} />
        <RefRow ctx={ctx} />
      </DocHead>
      <Text style={s.para}>To whom it may concern</Text>
      <Particulars compact={compact} heading="BOOKING TRANSFER" rows={[
        ["Project", ctx.project.displayName],
        ["Plot No.", ctx.plot.no],
        ["Size", ctx.plot.sizeLabel],
        ["Booking Ref.", ctx.sale.bookingRef],
        ...ownerRows(transfer.previousOwners, "Transferred from"),
        ...ownerRows(transfer.newOwners, "Transferred to"),
        ["Transfer date", d(transfer.transferDate)],
        ...(transfer.fee ? [["Transfer fee received", pkr(transfer.fee)] as [string, string | null]] : []),
      ]} />
      <Text style={s.para}>
        All rights and obligations under the original booking, including the remaining installments,
        now rest with the new owner(s).
      </Text>
      <Signatures labels={letterSignatories} compact={compact} />
    </DocPage>
  );
}

function CancellationLetter({ ctx }: { ctx: DocContext }) {
  const cancellation = ctx.cancellation;
  if (!cancellation) throw new Error("Cancellation data is required.");
  const compact = ctx.layout.mode !== "plain";

  return (
    <DocPage ctx={ctx}>
      <DocHead ctx={ctx}>
        <TitleBlock ctx={ctx} />
        <RefRow ctx={ctx} />
      </DocHead>
      <Particulars compact={compact} heading="CANCELLED BOOKING" rows={[
        ...ownerRows([ctx.applicant, ...ctx.jointApplicants], "Buyer"),
        ["Project", ctx.project.displayName],
        ["Plot No.", ctx.plot.no],
        ["Booking Ref.", ctx.sale.bookingRef],
        ["Booking date", d(ctx.sale.bookingDate)],
        ["Cancellation date", d(cancellation.cancelledOn)],
        ["Reason", cancellation.reason],
      ]} />
      <Particulars compact={compact} heading="REFUND CALCULATION" rows={[
        ["Total sale price", pkr(cancellation.salePrice)],
        ["Amount received", pkr(cancellation.received)],
        [`Deduction (${cancellation.deductionPct}% of sale price)`, pkr(cancellation.deduction)],
        ["Refund due", pkr(cancellation.refundDue)],
      ]} />
      <Text style={s.para}>{pdfSafe(cancellation.refundWording)}</Text>
      <Signatures labels={[...letterSignatories, "Buyer acknowledgement signature"]} compact={compact} />
    </DocPage>
  );
}

function StatementOfAccount({ ctx }: { ctx: DocContext }) {
  const statement = ctx.statement;
  if (!statement) throw new Error("Statement data is required.");
  const compact = ctx.layout.mode !== "plain";
  const buyers = [ctx.applicant, ...ctx.jointApplicants];
  const date = formatDate(ctx.date);

  return (
    <DocPage ctx={ctx}>
      <DocHead ctx={ctx}>
        <TitleBlock ctx={ctx} subtitle={`Statement as of ${date}`} />
        {statement.cancelled && (
          <Text style={s.subtitle}>
            BOOKING CANCELLED{statement.cancelledOn ? ` on ${formatDate(statement.cancelledOn)}` : ""}
          </Text>
        )}
        <RefRow ctx={ctx} />
      </DocHead>
      <Particulars compact={compact} heading="BUYER AND PROPERTY" rows={[
        ...buyers.map((buyer, i): [string, string] => [
          i === 0 ? "Buyer" : `Joint buyer ${i}`,
          `${buyer.name} (CNIC ${buyer.cnic ?? "not recorded"})`,
        ]),
        ["Project", ctx.project.displayName],
        ["Plot No.", ctx.plot.no],
        ["Size", ctx.plot.sizeLabel],
        ["Booking Ref.", ctx.sale.bookingRef],
        ["Booking Date", d(ctx.sale.bookingDate)],
        ["Payment Plan", statement.paymentPlan],
      ]} />
      <Particulars compact={compact} heading="SUMMARY" rows={[
        ["Total Sale Price", pkr(ctx.sale.totalPrice)],
        ["Total Received (Cleared)", pkr(statement.received)],
        ...(statement.received !== statement.receivedForSale
          ? [["Received Toward Sale Price", pkr(statement.receivedForSale)] as [string, string | null]]
          : []),
        ...(statement.waived !== "0.00" ? [["Principal Waived", pkr(statement.waived)] as [string, string | null]] : []),
        ["Outstanding Sale Balance", pkr(statement.outstanding)],
        ["Overdue as of Today", pkr(statement.overdue)],
        ["Late Charges Accrued", pkr(statement.feesAccrued)],
        ["Late Charges Outstanding", pkr(statement.feesOutstanding)],
        ["Next Due", statement.nextDue ? `${formatDate(statement.nextDue.date)} / ${pkr(statement.nextDue.amount)}` : "None"],
      ]} />
      <StatementTable
        title="INSTALLMENT SCHEDULE"
        columns={["No.", "Description", "Due Date", "Amount Due", "Paid", "Balance", "Status"]}
        rows={statement.schedule.map((row) => [
          String(row.no), row.label, d(row.dueDate) ?? "-", pkr(row.due) ?? "-", pkr(row.paid) ?? "-",
          pkr(row.balance) ?? "-", row.status,
        ])}
      />
      <StatementTable
        title="PAYMENTS RECEIVED"
        columns={["Date", "Receipt No.", "Mode", "Instrument No.", "Amount", "Status"]}
        rows={statement.payments.map((payment) => [
          formatDate(payment.date), payment.receiptNo, payment.mode, payment.instrumentNo ?? "-",
          pkr(payment.amount) ?? "-", payment.status,
        ])}
      />
      <Text style={[s.para, { marginTop: 8 }]}>
        This statement reflects payments recorded up to {date}. Please report any discrepancy within 15 days.
      </Text>
    </DocPage>
  );
}

// ---------------------------------------------------------------- Payment Receipt
function PaymentReceipt({ ctx }: { ctx: DocContext }) {
  const compact = ctx.layout.mode !== "plain";
  const r = ctx.receipt;
  return (
    <DocPage ctx={ctx}>
      <DocHead ctx={ctx}>
        <TitleBlock ctx={ctx} />
        <RefRow ctx={ctx} label="Receipt No." />
      </DocHead>
      <Particulars
        compact={compact}
        heading="RECEIVED FROM"
        rows={[
          ["Name", ctx.applicant.name],
          ["CNIC No.", ctx.applicant.cnic ?? ctx.applicant.passport],
          ["Project", ctx.project.displayName],
          ["Plot No.", [ctx.plot.no, ctx.plot.block, ctx.plot.street].filter(Boolean).join(" · ")],
          ["Booking Ref.", ctx.sale.bookingRef],
        ]}
      />
      <Particulars
        compact={compact}
        heading="PAYMENT DETAILS"
        rows={[
          ["Amount", pkr(r?.amount)],
          ["Amount in Words", r ? rupeesInWords(r.amount) : null],
          ["Mode", r?.mode],
          ["Bank", r?.bank ?? "N/A"],
          ["Instrument No.", r?.instrumentNo ?? "N/A"],
          ["Instrument Date", d(r?.instrumentDate) ?? "N/A"],
          ["Status", r?.status],
        ]}
      />
      <Signatures compact={compact} labels={["Received by (Accounts)", "Company Stamp"]} />
    </DocPage>
  );
}

const DOCS = {
  booking_form: BookingForm,
  allotment_letter: AllotmentLetter,
  sale_agreement: SaleAgreement,
  installment_schedule: InstallmentSchedule,
  possession_letter: PossessionLetter,
  ndc_letter: NdcLetter,
} as const;

export type PrintableDocType = keyof typeof DOCS;
export const PRINTABLE_DOC_TYPES = Object.keys(DOCS) as PrintableDocType[];

export const DOC_LABELS: Record<PrintableDocType, string> = {
  booking_form: "Booking Form",
  allotment_letter: "Allotment Letter",
  sale_agreement: "Sale Agreement",
  installment_schedule: "Installment Payment Schedule",
  possession_letter: "Possession Letter",
  ndc_letter: "No Dues Certificate",
};

export function DocumentPdf({ ctx }: { ctx: DocContext }) {
  const Body = ctx.docType === "payment_receipt" ? PaymentReceipt
    : ctx.docType === "cancellation_letter" ? CancellationLetter
    : ctx.docType === "transfer_letter" ? TransferLetter
    : ctx.docType === "statement_of_account" ? StatementOfAccount
    : DOCS[ctx.docType as PrintableDocType];
  return (
    <Document title={`${ctx.template.title} ${ctx.refNo ?? ""}`.trim()} author={ctx.company.partnerName} creator="Waystar Property Portal">
      <Body ctx={ctx} />
    </Document>
  );
}
