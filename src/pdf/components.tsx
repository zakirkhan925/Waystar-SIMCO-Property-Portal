import { Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDate } from "@/lib/dates";
import { BLANK, fillPlaceholders, type TemplateSection } from "./template";
import { A4, type DocContext } from "./types";

// Built-in Helvetica covers WinAnsi only; map the few typographic characters it lacks.
export function pdfSafe(s: string): string {
  return s.replace(/′/g, "'").replace(/″/g, '"').replace(/−/g, "-");
}

const INK = "#111827";
const MUTED = "#6b7280";
const BRAND = "#3f4442";   // the graphite of the Waystar Royco signage
const RULE = "#9ca3af";

export const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 64, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 9.5, color: INK, lineHeight: 1.4 },
  letterhead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderBottomColor: BRAND, paddingBottom: 6, marginBottom: 12 },
  company: { fontFamily: "Helvetica-Bold", fontSize: 14, color: BRAND, letterSpacing: 1 },
  companySub: { fontSize: 8, color: MUTED },
  projectName: { fontFamily: "Helvetica-Bold", fontSize: 11, textAlign: "right" },
  projectAddr: { fontSize: 8, color: MUTED, textAlign: "right" },
  title: { fontFamily: "Helvetica-Bold", fontSize: 14, textAlign: "center", letterSpacing: 1.5, marginBottom: 4 },
  subtitle: { fontSize: 9, textAlign: "center", color: MUTED, marginBottom: 6 },
  refRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, fontSize: 9.5 },
  bold: { fontFamily: "Helvetica-Bold" },
  heading: { fontFamily: "Helvetica-Bold", fontSize: 10, color: BRAND, marginTop: 8, marginBottom: 3, letterSpacing: 0.5 },
  para: { marginBottom: 5, textAlign: "justify" },
  bulletRow: { flexDirection: "row", marginBottom: 3 },
  bullet: { width: 12 },
  bulletText: { flex: 1, textAlign: "justify" },
  table: { borderWidth: 0.75, borderColor: RULE, marginBottom: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: RULE },
  trLast: { flexDirection: "row" },
  tdLabel: { width: "36%", paddingVertical: 3, paddingHorizontal: 4, fontFamily: "Helvetica-Bold", backgroundColor: "#f3f4f6", borderRightWidth: 0.75, borderRightColor: RULE },
  tdValue: { width: "64%", paddingVertical: 3, paddingHorizontal: 4 },
  sigRow: { flexDirection: "row", gap: 24, marginTop: 26 },
  sigCell: { flex: 1, borderTopWidth: 0.75, borderTopColor: INK, paddingTop: 4, fontSize: 8.5 },
  footerRule: { position: "absolute", bottom: 50, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: RULE },
  qr: { position: "absolute", bottom: 12, left: 44, width: 34, height: 34 },
  footerText: { position: "absolute", bottom: 20, right: 120, fontSize: 7, color: MUTED, lineHeight: 1.3 },
  // anchored from the top: react-pdf mis-places render-prop text anchored with "bottom" on multi-page docs
  pageNo: { position: "absolute", top: 813, left: 44, right: 44, textAlign: "right", fontSize: 7, color: MUTED },
  watermark: { position: "absolute", top: 360, left: 40, right: 40, textAlign: "center", fontSize: 54, color: "#ef4444", opacity: 0.12, transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" },
});

export function Letterhead({ ctx }: { ctx: DocContext }) {
  return (
    <View style={s.letterhead} fixed>
      <View>
        <Text style={s.company}>{ctx.company.partnerName.toUpperCase()}</Text>
        <Text style={s.companySub}>Marketed by {ctx.settings.marketed_by ?? ctx.company.name}</Text>
      </View>
      <View>
        <Text style={s.projectName}>{ctx.project.displayName}</Text>
        {ctx.project.fullAddress && <Text style={s.projectAddr}>{ctx.project.fullAddress}</Text>}
      </View>
    </View>
  );
}

/**
 * Page-1 heading (title, ref/date, addressee). On a letterhead with a heading zone it is placed higher,
 * beside the letterhead artwork, so the body can use the rest of the page; otherwise it flows normally.
 * Absolutely positioned and not "fixed", so it appears on page 1 only.
 */
export function DocHead({ ctx, children }: { ctx: DocContext; children: React.ReactNode }) {
  const L = ctx.layout;
  if (L.mode === "plain" || !L.head) return <>{children}</>;
  return (
    <View style={{ position: "absolute", top: L.head.top, left: L.head.left, right: L.right, maxHeight: L.top - L.head.top - 4 }}>
      {children}
    </View>
  );
}

export function TitleBlock({ ctx, subtitle }: { ctx: DocContext; subtitle?: string }) {
  return (
    <View>
      <Text style={s.title}>{ctx.template.title}</Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
  );
}

export function RefRow({ ctx, label = "Ref. No." }: { ctx: DocContext; label?: string }) {
  return (
    <View style={s.refRow}>
      <Text>
        <Text style={s.bold}>{label}: </Text>
        {ctx.refNo ?? `${ctx.template.ref_prefix}-${BLANK}`}
      </Text>
      <Text>
        <Text style={s.bold}>Date: </Text>
        {formatDate(ctx.date)}
      </Text>
    </View>
  );
}

/** compact: letterhead / pre-printed pages, where tables and gaps are a little tighter. */
export function Particulars({
  heading,
  rows,
  compact = false,
}: {
  heading?: string;
  rows: [string, string | null | undefined][];
  compact?: boolean;
}) {
  const pad = compact ? { paddingVertical: 2 } : null;
  return (
    <View wrap={false}>
      {heading && <Text style={[s.heading, pad ? { marginTop: 6 } : {}]}>{heading}</Text>}
      <View style={s.table}>
        {rows.map(([label, value], i) => (
          <View key={label} style={i === rows.length - 1 ? s.trLast : s.tr}>
            <Text style={[s.tdLabel, pad ?? {}]}>{label}:</Text>
            <Text style={[s.tdValue, pad ?? {}]}>{pdfSafe(value && String(value).trim() ? String(value) : BLANK)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Render template sections (clause text from the database) with placeholders filled. */
export function Sections({
  sections,
  vars,
  only,
  except,
}: {
  sections: TemplateSection[];
  vars: Record<string, string | null | undefined>;
  only?: string[];
  except?: string[];
}) {
  const list = sections.filter((sec) => (!only || only.includes(sec.key)) && (!except || !except.includes(sec.key)));
  return (
    <>
      {list.map((sec) => (
        <View key={sec.key}>
          {sec.heading ? <Text style={s.heading} minPresenceAhead={40}>{sec.heading}</Text> : null}
          {sec.items.map((item, i) => {
            if (typeof item !== "string") {
              return (
                <View key={i} style={{ marginBottom: 5 }} wrap={false}>
                  <Text style={s.bold}>{pdfSafe(`${i + 1}. ${fillPlaceholders(item.title, vars)}`)}</Text>
                  <Text style={s.para}>{pdfSafe(fillPlaceholders(item.text, vars))}</Text>
                </View>
              );
            }
            const text = pdfSafe(fillPlaceholders(item, vars));
            if (sec.style === "paragraphs") return <Text key={i} style={s.para}>{text}</Text>;
            return (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bullet}>{sec.style === "numbered" ? `${i + 1}.` : "•"}</Text>
                <Text style={s.bulletText}>{text}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
}

export function Signatures({ labels, compact = false }: { labels: string[]; compact?: boolean }) {
  return (
    <View style={[s.sigRow, compact ? { marginTop: 12 } : {}]} wrap={false}>
      {labels.map((l) => (
        <View key={l} style={s.sigCell}>
          <Text>{pdfSafe(l)}</Text>
          <Text style={{ marginTop: compact ? 3 : 6, color: MUTED }}>Date: ____________________</Text>
        </View>
      ))}
    </View>
  );
}

const footerLine = (ctx: DocContext) =>
  [
    pdfSafe(`${ctx.template.title} · ${ctx.refNo ?? "unnumbered"} · template v${ctx.template.version}`),
    ctx.verifyUrl ? `Verify authenticity: ${ctx.verifyUrl}` : "Specimen - not a valid document",
  ].join("\n");

/** Height of the QR / verification strip kept above the letterhead footer. */
const STRIP = 30;

export function DocPage({ ctx, children }: { ctx: DocContext; children: React.ReactNode }) {
  const L = ctx.layout;
  const watermark = ctx.specimen && (
    <Text style={s.watermark} fixed>
      SPECIMEN
    </Text>
  );

  if (L.mode === "plain") {
    return (
      <Page size="A4" style={s.page}>
        {watermark}
        <Letterhead ctx={ctx} />
        {children}
        <View style={s.footerRule} fixed />
        {ctx.qrDataUrl && (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
          <Image src={ctx.qrDataUrl} style={s.qr} fixed />
        )}
        <Text style={[s.footerText, { left: ctx.qrDataUrl ? 84 : 44 }]} fixed>
          {footerLine(ctx)}
        </Text>
        <Text style={s.pageNo} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    );
  }

  // Letterhead / pre-printed paper: everything stays inside the letterhead's safe area.
  const stripTop = A4.height - L.bottom - STRIP; // anchored from the top (react-pdf mis-places "bottom" on multi-page docs)
  return (
    <Page
      size="A4"
      // slightly tighter type: the letterhead leaves ~30% less writing space per page than plain paper
      style={[s.page, { paddingTop: L.top, paddingBottom: L.bottom + STRIP + 4, paddingLeft: L.left, paddingRight: L.right, fontSize: 9, lineHeight: 1.32 }]}
    >
      {watermark}
      {children}
      {ctx.qrDataUrl && (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
        <Image src={ctx.qrDataUrl} style={[s.qr, { bottom: undefined, top: stripTop + 3, left: L.left, width: 26, height: 26 }]} fixed />
      )}
      <Text
        style={[s.footerText, { bottom: undefined, top: stripTop + 8, left: L.left + (ctx.qrDataUrl ? 32 : 0), right: L.right + 70 }]}
        fixed
      >
        {footerLine(ctx)}
      </Text>
      <Text
        style={[s.pageNo, { top: stripTop + 12, left: L.left, right: L.right }]}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        fixed
      />
    </Page>
  );
}
