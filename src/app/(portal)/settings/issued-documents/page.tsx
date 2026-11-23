import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ConfirmWithReason } from "@/components/confirm-delete";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { revokeDocument } from "@/features/issued-documents/actions";
import { listIssuedDocuments } from "@/features/issued-documents/queries";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { DOC_LABELS } from "@/pdf/documents";

export const metadata: Metadata = { title: "Issued documents" };

const labels: Record<string, string> = {
  ...DOC_LABELS,
  payment_receipt: "Payment Receipt",
  statement_of_account: "Statement of Account",
  transfer_letter: "Transfer Letter",
  cancellation_letter: "Cancellation Letter",
  rent_receipt: "Rent Receipt",
  rent_invoice: "Rent Invoice",
  lease_agreement: "Lease Summary",
};

export default async function IssuedDocumentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole("super_admin");
  const page = z.coerce.number().int().min(1).max(10_000_000).catch(1).parse((await searchParams).page);
  const { rows, hasNext } = await listIssuedDocuments(page);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Settings", href: "/settings" }, { label: "Issued documents" }]}
        title="Issued documents"
      />
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Plot</TableHead>
              <TableHead>Issued on</TableHead>
              <TableHead>Issued by</TableHead>
              <TableHead>Status</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.ref_no}</TableCell>
                <TableCell>{labels[doc.doc_type] ?? doc.doc_type}</TableCell>
                <TableCell>{doc.sales?.units?.unit_no ?? doc.leases?.units?.unit_no ?? "—"}</TableCell>
                <TableCell>{formatDate(doc.issued_at)}</TableCell>
                <TableCell>{doc.profiles?.full_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={doc.revoked_at ? "destructive" : "secondary"}>{doc.revoked_at ? "Revoked" : "Issued"}</Badge>
                  {doc.revoked_reason && <div className="mt-1 max-w-xs whitespace-normal text-xs text-muted-foreground">{doc.revoked_reason}</div>}
                </TableCell>
                <TableCell className="text-right">
                  {!doc.revoked_at && (
                    <ConfirmWithReason
                      title={`Revoke ${doc.ref_no}?`}
                      description="Anyone who scans its QR code will see that this document has been revoked."
                      action={revokeDocument.bind(null, doc.token)}
                      trigger={<Button variant="destructive" size="sm">Revoke</Button>}
                      label="Revoke"
                      pendingLabel="Revoking…"
                      reasonLabel="Reason for revocation"
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={7}>No issued documents on this page.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {(page > 1 || hasNext) && (
        <nav aria-label="Issued documents pages" className="mt-4 flex justify-end gap-2">
          {page > 1 && <Button variant="outline" size="sm" asChild><Link href={`?page=${page - 1}`}>Previous</Link></Button>}
          {hasNext && <Button variant="outline" size="sm" asChild><Link href={`?page=${page + 1}`}>Next</Link></Button>}
        </nav>
      )}
    </>
  );
}
