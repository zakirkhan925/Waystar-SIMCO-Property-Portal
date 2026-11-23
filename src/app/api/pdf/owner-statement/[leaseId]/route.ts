import type { NextRequest } from "next/server";
import { rentalPdf } from "@/pdf/rental-route";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ leaseId: string }> }) {
  return rentalPdf(request, "owner_statement", (await params).leaseId);
}
