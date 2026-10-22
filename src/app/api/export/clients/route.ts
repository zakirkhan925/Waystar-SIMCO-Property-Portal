import type { NextRequest } from "next/server";
import { listClientsAll } from "@/features/clients/queries";
import { csvResponse, toCsv } from "@/lib/csv";
import { todayPK, formatDate } from "@/lib/dates";

/** CSV of clients matching the search (RLS applies — agents export only their own clients). */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const rows = await listClientsAll(q);
  const csv = toCsv(
    ["Name", "Relation", "Father/Husband", "CNIC", "Passport", "Phone", "WhatsApp", "Email", "City", "Country", "Overseas", "Added"],
    rows.map((c) => [
      c.full_name, c.relation_type?.toUpperCase(), c.guardian_name, c.cnic, c.passport_no, c.phone, c.whatsapp, c.email,
      c.city, c.country, c.is_overseas ? "Yes" : "No", formatDate(c.created_at),
    ]),
  );
  return csvResponse(`clients-${todayPK()}.csv`, csv);
}
