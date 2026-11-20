import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { parsePaymentFilters } from "@/features/payments/filters";
import { listPaymentsAll, listPaymentsPage, paymentTotals } from "@/features/payments/queries";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const today = "2028-02-19";
const receivedOn = "2028-02-07";
const payments = [
  { status: "valid", instrument_status: "cleared", amount: "0.10" },
  { status: "valid", instrument_status: "not_applicable", amount: "0.20" },
  { status: "valid", instrument_status: "pending", amount: "100.00" },
  { status: "valid", instrument_status: "bounced", amount: "200.00" },
  { status: "reversed", instrument_status: "bounced", amount: "300.00" },
].map((payment, index) => ({
  ...payment,
  id: `00000000-0000-4000-8000-00000000000${5 - index}`,
  received_on: receivedOn,
}));

function mockPaymentsApi() {
  const requests: URLSearchParams[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const params = new URL(String(input)).searchParams;
    requests.push(params);
    const cursor = params.getAll("or").find((condition) => condition.startsWith("(received_on.lt."));
    const after = cursor ? payments.findIndex((payment) => cursor.includes(payment.id)) + 1 : 0;
    // Return at most two rows to simulate a server limit below the requested batch size.
    return Response.json(payments.slice(after, after + 2), {
      headers: { "Content-Range": `0-1/${payments.length}` },
    });
  });
  vi.mocked(createClient).mockResolvedValue(
    createSupabaseClient<Database>("http://localhost:54321", "test-key", {
      global: { fetch },
      auth: { persistSession: false },
    }),
  );
  return requests;
}

describe("payments register", () => {
  it("defaults to the current month and supports open-ended dates and enum keys", () => {
    expect(parsePaymentFilters({}, today)).toMatchObject({ from: "2028-02-01", to: "2028-02-29" });
    expect(parsePaymentFilters({ from: "any", to: "2028-02-07", mode: "cheque", status: "pending" }, today))
      .toMatchObject({ from: "any", to: "2028-02-07", mode: "cheque", status: "pending" });
  });

  it("uses the same filters for the page, totals and complete export", async () => {
    const requests = mockPaymentsApi();
    const filters = parsePaymentFilters({ q: 'Block (A), "12"', from: "any", to: "2028-02-29" }, today);
    const page = await listPaymentsPage({ ...filters, page: 1, size: 25 });
    const totals = await paymentTotals(filters);
    const exported = await listPaymentsAll(filters);

    expect(page.total).toBe(5);
    expect(exported.map(({ id }) => id)).toEqual(payments.map(({ id }) => id));
    expect(totals.cleared.count).toBe(2);
    expect(totals.cleared.amount.toFixed(2)).toBe("0.30");
    expect(totals.pending.amount.toFixed(2)).toBe("100.00");
    expect(totals.bounced.amount.toFixed(2)).toBe("200.00");
    expect(totals.reversed.amount.toFixed(2)).toBe("300.00");

    const search = requests[0].get("or");
    expect(search).toContain("receipt_no.imatch.");
    expect(search).toContain("instrument_no.imatch.");
    expect(search).toContain("plot_match.not.is.null,buyer_match.not.is.null");
    for (const params of requests) {
      expect(params.getAll("or")[0]).toBe(search);
      expect(params.getAll("received_on")).toEqual(["lte.2028-02-29"]);
      expect(params.get("buyer_match.sale_buyers.clients.full_name")).toBe('imatch.Block \\(A\\), "12"');
    }
  });
});
