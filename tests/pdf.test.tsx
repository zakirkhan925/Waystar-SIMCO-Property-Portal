import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { rupeesInWords } from "@/lib/amount-words";
import { DocumentPdf, PRINTABLE_DOC_TYPES, templateVars } from "@/pdf/documents";
import { sampleDeal } from "@/pdf/sample";
import { BLANK, fillPlaceholders, type DocumentTemplate } from "@/pdf/template";
import type { DocContext } from "@/pdf/types";

// Optional: PDF_TEMPLATES=<json exported from document_templates> PDF_OUT=<dir> renders the real wording to files.
const fixture = process.env.PDF_TEMPLATES
  ? (JSON.parse(readFileSync(process.env.PDF_TEMPLATES, "utf8")) as { templates: DocumentTemplate[]; settings: Record<string, unknown> })
  : null;

function ctxFor(docType: string): DocContext {
  const template: DocumentTemplate = fixture?.templates.find((t) => t.doc_type === docType) ?? {
    doc_type: docType,
    version: 1,
    title: docType.toUpperCase(),
    ref_prefix: "TST",
    sections: [
      { key: "intro", heading: "", style: "paragraphs", items: ["Plot {{plot_no}} at {{project_name}}, {{missing_value}}."] },
      { key: "terms", heading: "TERMS", style: "clauses", items: [{ title: "Price", text: "{{total_price}} ({{total_price_words}})" }] },
    ],
  };
  const settings = Object.fromEntries(
    Object.entries(fixture?.settings ?? { marketed_by: "Waystar Royco" }).map(([k, v]) => [k, v === null ? null : String(v)]),
  );
  return {
    ...sampleDeal("2026-10-22"),
    docType,
    template,
    company: { name: "Waystar Royco Marketing", partnerName: "SIMCO Developers", address: null, phone: null, email: null, website: null },
    project: { code: "SV", name: "Simco Villas", displayName: "SIMCO VILLAS", fullAddress: "PMO Road, Taxila, District Rawalpindi" },
    settings,
    verifyUrl: null,
    qrDataUrl: null,
  };
}

describe("PDF documents", () => {
  it.each(PRINTABLE_DOC_TYPES)("renders %s", async (docType) => {
    const buf = await renderToBuffer(<DocumentPdf ctx={ctxFor(docType)} />);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    if (process.env.PDF_OUT) {
      mkdirSync(process.env.PDF_OUT, { recursive: true });
      writeFileSync(join(process.env.PDF_OUT, `${docType}.pdf`), buf);
    }
  }, 30_000);

  it("fills placeholders and leaves unknown ones as blanks", () => {
    const vars = templateVars(ctxFor("booking_form"));
    expect(fillPlaceholders("Plot {{plot_no}}, {{nope}}", vars)).toBe(`Plot 104, ${BLANK}`);
    expect(vars.total_price).toBe("PKR 8,250,000");
  });

  it("schedule sums exactly to the sale price (rounding to last installment)", () => {
    const { schedule, sale } = sampleDeal("2026-10-22");
    const sum = schedule.reduce((a, r) => a + Math.round(Number(r.amount) * 100), 0);
    expect(sum).toBe(Math.round(Number(sale.totalPrice) * 100));
    expect(schedule).toHaveLength(9);
    expect(schedule[1].dueDate).toBe("2027-01-22");
  });
});

describe("amount in words", () => {
  it("uses crore / lakh", () => {
    expect(rupeesInWords("8250000")).toBe("Eighty-Two Lakh Fifty Thousand");
    expect(rupeesInWords("12500000")).toBe("One Crore Twenty-Five Lakh");
    expect(rupeesInWords("1005")).toBe("One Thousand Five");
    expect(rupeesInWords("250000.50")).toBe("Two Lakh Fifty Thousand and Fifty Paisa");
  });
});
