import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { createElement } from "react";
import { DocumentPdf } from "./documents";
import { placeOnLetterhead } from "./letterhead";
import type { DocContext } from "./types";

export async function qrDataUrl(text: string) {
  return QRCode.toDataURL(text, { margin: 0, width: 160, errorCorrectionLevel: "M" });
}

/** Render a document; in "letterhead" mode the project's letterhead PDF is placed behind every page. */
export async function renderDocumentPdf(ctx: DocContext, letterhead?: Uint8Array | null): Promise<Uint8Array> {
  // createElement keeps this file .ts; DocumentPdf returns a react-pdf <Document>
  const content = await renderToBuffer(createElement(DocumentPdf, { ctx }) as Parameters<typeof renderToBuffer>[0]);
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
