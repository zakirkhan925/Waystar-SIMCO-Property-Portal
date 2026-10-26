import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { rupeesInWords } from "@/lib/amount-words";
import { PDFDocument, rgb } from "pdf-lib";
import { DocumentPdf, PRINTABLE_DOC_TYPES, templateVars } from "@/pdf/documents";
import { layoutFor, placeOnLetterhead } from "@/pdf/letterhead";
import { sampleDeal } from "@/pdf/sample";
import { BLANK, fillPlaceholders, type DocumentTemplate } from "@/pdf/template";
import type { DocContext, PageLayout } from "@/pdf/types";

// Optional: PDF_TEMPLATES=<json exported from document_templates> PDF_OUT=<dir> renders the real wording to files.
const fixture = process.env.PDF_TEMPLATES
  ? (JSON.parse(readFileSync(process.env.PDF_TEMPLATES, "utf8")) as { templates: DocumentTemplate[]; settings: Record<string, unknown> })
  : null;

// Letterhead geometry measured from the SIMCO VILLAS letterhead (see migration 20261026000100)
const SIMCO = layoutFor("letterhead", { letterhead_path: "x.pdf", letterhead_head_top_mm: 40, letterhead_head_left_mm: 42 });

function ctxFor(docType: string, layout: PageLayout = layoutFor("plain", {})): DocContext {
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
    layout,
    verifyUrl: null,
    qrDataUrl: null,
  };
}

/** Real letterhead if PDF_LETTERHEAD is set, else a generated A4 page with a header band and footer rule. */
async function letterheadBytes(): Promise<Uint8Array> {
  if (process.env.PDF_LETTERHEAD) return new Uint8Array(readFileSync(process.env.PDF_LETTERHEAD));
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 0, y: 841.89 - 100, width: 595.28, height: 100, color: rgb(0.9, 0.85, 0.7) });
  page.drawRectangle({ x: 29, y: 841.89 - 772, width: 537, height: 1.5, color: rgb(0.7, 0.5, 0.2) });
  return doc.save();
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

  it.each(PRINTABLE_DOC_TYPES)("renders %s on the letterhead and for pre-printed paper", async (docType) => {
    const lh = await letterheadBytes();
    for (const mode of ["letterhead", "preprinted"] as const) {
      const content = await renderToBuffer(<DocumentPdf ctx={ctxFor(docType, { ...SIMCO, mode })} />);
      const out = mode === "letterhead" ? await placeOnLetterhead(content, lh) : content;
      const doc = await PDFDocument.load(out);
      const src = await PDFDocument.load(content);
      expect(doc.getPageCount()).toBe(src.getPageCount()); // one sheet per document page
      expect(Math.round(doc.getPage(0).getHeight())).toBe(842);
      if (process.env.PDF_OUT) writeFileSync(join(process.env.PDF_OUT, `${docType}-${mode}.pdf`), out);
    }
  }, 60_000);

  it("converts letterhead margins from mm and falls back to plain without a letterhead", () => {
    expect(SIMCO.mode).toBe("letterhead");
    expect(SIMCO.top).toBeCloseTo(226.8, 1); // 80 mm: body starts below the tagline (ends at 210.5 pt)
    expect(SIMCO.head?.top).toBeCloseTo(113.4, 1); // page-1 heading below the logos (end at 98 pt)…
    expect(SIMCO.head?.left).toBeCloseTo(119.1, 1); // …and right of the tagline (ends at 111.5 pt)
    expect(layoutFor("letterhead", { letterhead_path: "x.pdf" }).head).toBeNull();
    expect(SIMCO.bottom).toBeCloseTo(80.8, 1); // 28.5 mm, above the footer rule at 771 pt
    expect(SIMCO.left).toBeCloseTo(45.9, 1); // aligned with "SIMCOVILLAS" (45.5 pt)
    expect(layoutFor(null, {}).mode).toBe("plain");
    expect(layoutFor("letterhead", {}).mode).toBe("plain"); // nothing to put behind the page
    expect(layoutFor("preprinted", {}).mode).toBe("preprinted");
  });

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
