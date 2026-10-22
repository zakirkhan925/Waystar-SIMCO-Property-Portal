import Decimal from "decimal.js";
import { addMonths, format } from "date-fns";
import type { DocContext, ScheduleRow } from "./types";

/**
 * Sample deal used to preview templates before real bookings exist (Phase 2 replaces this with sale data).
 * Mirrors the Simco Villas plan: 30% down payment at booking + 8 equal quarterly installments of 8.75%.
 */
export function sampleDeal(today: string): Omit<DocContext, "docType" | "template" | "company" | "project" | "settings" | "qrDataUrl" | "verifyUrl"> {
  const total = new Decimal("8250000.00");
  const booking = new Date(`${today}T00:00:00`);
  const down = total.times(0.3).toDecimalPlaces(2);
  const each = total.minus(down).div(8).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const schedule: ScheduleRow[] = [
    { no: 1, label: "Down Payment (at Booking)", dueDate: today, pct: "30", amount: down.toFixed(2) },
  ];
  let allocated = down;
  for (let i = 1; i <= 8; i++) {
    // rounding difference goes to the last installment
    const amt = i === 8 ? total.minus(allocated) : each;
    allocated = allocated.plus(amt);
    schedule.push({
      no: i + 1,
      label: `Installment ${i} (Quarterly)`,
      dueDate: format(addMonths(booking, i * 3), "yyyy-MM-dd"),
      pct: "8.75",
      amount: amt.toFixed(2),
    });
  }
  return {
    refNo: null,
    date: today,
    specimen: true,
    plot: { no: "104", block: "Block A", street: "Street 1", category: "Standard", sizeLabel: "5 Marla (25' × 50')", areaSqft: "1250" },
    applicant: {
      name: "Muhammad Asif Raja",
      relation: "S/O",
      guardian: "Raja Muhammad Akram",
      cnic: "37405-1234567-1",
      nationality: "Pakistani",
      address: "House 12, Street 4, Satellite Town, Rawalpindi",
      phone: "+92 300 5123456",
      email: "asif.raja@example.com",
    },
    jointApplicants: [{ name: "Ayesha Asif", cnic: "37405-7654321-2", relationship: "Wife" }],
    sale: {
      bookingRef: null,
      bookingDate: today,
      agreementRef: null,
      agreementDate: today,
      allotmentRef: null,
      allotmentDate: today,
      totalPrice: total.toFixed(2),
      bookingAmount: "500000.00",
      amountPaid: down.toFixed(2),
      lastPaymentDate: today,
      planType: "installment",
      downPaymentPct: "30",
      installmentCount: 8,
      frequencyLabel: "quarterly",
      paymentMode: "Pay Order",
      instrumentNo: "PO-0012345",
      duesClearedDate: today,
      possessionDate: today,
    },
    schedule,
    ndcPurpose: "transfer of ownership",
  };
}
