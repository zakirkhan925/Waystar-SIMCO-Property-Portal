import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { z } from "zod";
import { formatDate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Document verification",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const company = "Waystar Royco Marketing Pvt Ltd";
const valid = "bg-emerald-100 text-emerald-950";
const invalid = "bg-red-100 text-red-950";
const warning = "bg-amber-100 text-amber-950";
const banners = {
  valid: { label: "Genuine document", style: valid },
  revoked: { label: "Not valid (revoked)", style: invalid },
  terminated: { label: "Lease terminated", style: warning },
  expired: { label: "Lease expired", style: warning },
  cancelled: { label: "Cancelled", style: warning },
  superseded: { label: "Superseded", style: warning },
  reversed: { label: "Reversed", style: warning },
  bounced: { label: "Not valid (payment bounced)", style: invalid },
};

const verifiedDocument = z.object({
  document_type: z.string(),
  ref_no: z.string(),
  issued_on: z.iso.date(),
  project_name: z.string(),
  plot_no: z.string().nullable(),
  buyer_name: z.string().nullable(),
  tenant_name: z.string().nullable().optional(),
  status: z.enum(["valid", "revoked", "cancelled", "superseded", "reversed", "bounced", "terminated", "expired"]),
  amount: z.string().optional(),
});

async function verify(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { data, error } = await supabase.rpc("verify_document", { p_token: token });
  if (error) throw new Error("The document verification service is unavailable.", { cause: error });
  return data === null ? null : verifiedDocument.parse(data);
}

export default async function VerificationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = await verify(token);
  const banner = doc ? banners[doc.status] : { label: "Not valid", style: invalid };
  const fields = doc && [
    ["Document", doc.document_type],
    ["Reference number", doc.ref_no],
    ["Project", doc.project_name],
    ["Plot number", doc.plot_no],
    ...(doc.tenant_name === undefined ? [["Buyer", doc.buyer_name]] : [["Tenant", doc.tenant_name]]),
    ...(doc.amount === undefined ? [] : [["Receipt amount", formatPKR(doc.amount)]]),
  ];

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 py-10 sm:py-16">
      <p className="font-semibold">{company}</p>
      <section className="overflow-hidden rounded-xl border bg-card text-card-foreground">
        <h1 className={`px-5 py-4 text-2xl font-semibold ${banner.style}`}>{banner.label}</h1>
        {doc && fields ? (
          <div className="space-y-5 p-5">
            <dl className="divide-y">
              {fields.map(([label, value]) => value && (
                <div key={label} className="grid gap-1 py-2 sm:grid-cols-2">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="wrap-break-word font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">Issued by {company} on {formatDate(doc.issued_on)}.</p>
          </div>
        ) : (
          <p className="p-5">We could not find this document. It may be forged — please contact our office.</p>
        )}
      </section>
    </main>
  );
}
