import type { NextRequest } from "next/server";
import { rentalPdf } from "@/pdf/rental-route";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  return rentalPdf(request, "rent_receipt", (await params).paymentId);
}
