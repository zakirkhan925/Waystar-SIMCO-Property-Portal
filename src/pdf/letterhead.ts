import { PDFDocument } from "pdf-lib";
import { MM, type PageLayout } from "./types";

/**
 * Put the letterhead (page 1 of the letterhead PDF) behind every page of a rendered document.
 * Both are embedded as vector pages, so print quality is preserved.
 */
export async function placeOnLetterhead(content: Uint8Array, letterhead: Uint8Array, title?: string): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const [background] = await out.embedPdf(letterhead, [0]);
  const source = await PDFDocument.load(content);
  const pages = await out.embedPdf(content, source.getPageIndices());

  for (const page of pages) {
    const sheet = out.addPage([page.width, page.height]);
    // letterhead scaled to the document page (both are A4 for SIMCO, but don't assume it)
    sheet.drawPage(background, { x: 0, y: 0, width: page.width, height: page.height });
    sheet.drawPage(page, { x: 0, y: 0, width: page.width, height: page.height });
  }
  if (title) out.setTitle(title);
  out.setCreator("Waystar Property Portal");
  return out.save();
}

type LetterheadSettings = {
  letterhead_path?: string | null;
  letterhead_top_mm?: string | number | null;
  letterhead_bottom_mm?: string | number | null;
  letterhead_left_mm?: string | number | null;
  letterhead_right_mm?: string | number | null;
  letterhead_head_top_mm?: string | number | null;
  letterhead_head_left_mm?: string | number | null;
};

const PLAIN: PageLayout = { mode: "plain", top: 36, bottom: 64, left: 44, right: 44, head: null };
const blank = (v: unknown) => v === null || v === undefined || v === "";

/** Page layout for a project, given the requested print mode and its letterhead settings (mm → pt). */
export function layoutFor(requested: string | null | undefined, s: LetterheadSettings): PageLayout {
  const hasLetterhead = Boolean(s.letterhead_path);
  const mode =
    requested === "plain" || requested === "preprinted" || requested === "letterhead" ? requested : hasLetterhead ? "letterhead" : "plain";
  if (mode === "plain" || (mode === "letterhead" && !hasLetterhead)) return PLAIN;
  const mm = (v: string | number | null | undefined, fallback: number) => (blank(v) ? fallback : Number(v)) * MM;
  return {
    mode,
    top: mm(s.letterhead_top_mm, 80),
    bottom: mm(s.letterhead_bottom_mm, 28.5),
    left: mm(s.letterhead_left_mm, 16.2),
    right: mm(s.letterhead_right_mm, 10),
    head:
      blank(s.letterhead_head_top_mm) ? null : { top: mm(s.letterhead_head_top_mm, 40), left: mm(s.letterhead_head_left_mm, 42) },
  };
}
