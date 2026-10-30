import { formatDate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";

export type ReminderInput = {
  clientName: string | null;
  unitNo: string | null;
  projectName: string;
  label: string | null;
  dueDate: string | null;
  outstanding: string | number | null;
  daysOverdue: number | null;
  companyName: string;
};

/**
 * The text an agent sends on WhatsApp or SMS. Deliberately plain and factual —
 * it states the amount and the date, and asks them to get in touch.
 */
export function reminderText(r: ReminderInput): string {
  const overdue = (r.daysOverdue ?? 0) > 0;
  const lines = [
    `Dear ${r.clientName ?? "Sir/Madam"},`,
    "",
    overdue
      ? `This is a reminder that your installment for ${r.projectName}, Unit ${r.unitNo} is overdue.`
      : `This is a reminder about the upcoming installment for ${r.projectName}, Unit ${r.unitNo}.`,
    "",
    `Installment: ${r.label ?? "—"}`,
    `Due date: ${r.dueDate ? formatDate(r.dueDate) : "—"}`,
    `Amount payable: ${formatPKR(r.outstanding ?? 0)}`,
  ];
  if (overdue) lines.push(`Days overdue: ${r.daysOverdue}`);
  lines.push(
    "",
    "Kindly arrange the payment at your earliest convenience. If you have already paid, please ignore this message and share the receipt.",
    "",
    `Thank you,`,
    r.companyName,
  );
  return lines.join("\n");
}

export const whatsappLink = (phone: string, text: string) =>
  `https://wa.me/${phone.replace(/\D/g, "").replace(/^0/, "92")}?text=${encodeURIComponent(text)}`;
