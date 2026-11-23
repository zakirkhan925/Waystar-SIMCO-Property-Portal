import type { NextRequest } from "next/server";
import { rentalPdf } from "@/pdf/rental-route";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ invoiceId: string }> }) {
  return rentalPdf(request, "rent_invoice", (await params).invoiceId);
}
