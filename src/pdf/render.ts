import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { createElement } from "react";
import { DocumentPdf } from "./documents";
import { placeOnLetterhead } from "./letterhead";
import type { DocContext, DocPageContext } from "./types";

export async function qrDataUrl(text: string, margin = 0) {
  return QRCode.toDataURL(text, { margin, width: 160, errorCorrectionLevel: "M" });
}

/** Render a document; in "letterhead" mode the project's letterhead PDF is placed behind every page. */
export async function renderDocumentPdf(ctx: DocContext, letterhead?: Uint8Array | null): Promise<Uint8Array> {
  return renderPdf(
    createElement(DocumentPdf, { ctx }) as Parameters<typeof renderToBuffer>[0],
    ctx,
    letterhead,
  );
}

export async function renderPdf(document: Parameters<typeof renderToBuffer>[0],
  ctx: DocPageContext, letterhead?: Uint8Array | null): Promise<Uint8Array> {
  const content = await renderToBuffer(document);
  if (ctx.layout.mode === "letterhead" && letterhead) {
    return placeOnLetterhead(content, letterhead, `${ctx.template.title} ${ctx.refNo ?? ""}`.trim());
  }
  return content;
}

export function pdfResponse(buffer: Uint8Array, filename: string, download = false) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
