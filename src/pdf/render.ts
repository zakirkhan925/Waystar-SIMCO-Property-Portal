import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { createElement } from "react";
import { DocumentPdf } from "./documents";
import type { DocContext } from "./types";

export async function qrDataUrl(text: string) {
  return QRCode.toDataURL(text, { margin: 0, width: 160, errorCorrectionLevel: "M" });
}

export async function renderDocumentPdf(ctx: DocContext): Promise<Buffer> {
  // createElement keeps this file .ts; DocumentPdf returns a react-pdf <Document>
  return renderToBuffer(createElement(DocumentPdf, { ctx }) as Parameters<typeof renderToBuffer>[0]);
}

export function pdfResponse(buffer: Buffer, filename: string, download = false) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
