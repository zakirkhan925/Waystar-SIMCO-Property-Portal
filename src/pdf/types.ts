import type { DocumentTemplate } from "./template";

export type Party = {
  name: string;
  relation?: string | null; // "S/O" | "D/O" | "W/O"
  guardian?: string | null;
  cnic?: string | null;
  passport?: string | null;
  nationality?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  relationship?: string | null; // joint applicant / nominee → applicant
};

export type ScheduleRow = {
  no: number;
  label: string;
  dueDate: string | null; // YYYY-MM-DD
  pct: string | null; // "8.75"
  amount: string; // numeric as string
  paidDate?: string | null;
  receivedBy?: string | null;
};

/** Everything a document needs. Money values are numeric strings (never JS floats). */
export type DocContext = {
  docType: DocumentTemplate["doc_type"];
  template: DocumentTemplate;
  refNo: string | null;
  date: string; // YYYY-MM-DD
  verifyUrl: string | null;
  qrDataUrl: string | null;
  specimen: boolean;
  company: { name: string; partnerName: string; address: string | null; phone: string | null; email: string | null; website: string | null };
  project: { code: string; name: string; displayName: string; fullAddress: string | null };
  settings: Record<string, string | null>; // project_document_settings, stringified
  plot: { no: string; block: string | null; street: string | null; category: "Standard" | "Corner"; sizeLabel: string; areaSqft: string };
  applicant: Party;
  jointApplicants: Party[];
  sale: {
    bookingRef: string | null;
    bookingDate: string | null;
    agreementRef: string | null;
    agreementDate: string | null;
    allotmentRef: string | null;
    allotmentDate: string | null;
    totalPrice: string;
    bookingAmount: string | null;
    amountPaid: string;
    lastPaymentDate: string | null;
    planType: "installment" | "full_cash";
    downPaymentPct: string | null;
    installmentCount: number | null;
    frequencyLabel: string | null; // "quarterly"
    paymentMode: string | null;
    instrumentNo: string | null;
    duesClearedDate: string | null;
    possessionDate: string | null;
  };
  schedule: ScheduleRow[];
  ndcPurpose: string | null;
};
