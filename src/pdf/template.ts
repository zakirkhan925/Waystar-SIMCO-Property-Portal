/** Shape of document_templates.sections (see migration 20261022000100). */
export type ClauseItem = string | { title: string; text: string };
export type TemplateSection = {
  key: string;
  heading: string;
  style: "bullets" | "numbered" | "paragraphs" | "clauses";
  items: ClauseItem[];
};
export type DocumentTemplate = {
  doc_type: string;
  version: number;
  title: string;
  ref_prefix: string;
  sections: TemplateSection[];
};

export const BLANK = "____________";

/** Replace {{name}} with vars[name]; unknown or empty values print as a blank line to fill by hand. */
export function fillPlaceholders(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => {
    const v = vars[key];
    return v === null || v === undefined || String(v).trim() === "" ? BLANK : String(v);
  });
}

/** Placeholder names used in a template, for the settings editor. */
export function placeholdersIn(sections: TemplateSection[]): string[] {
  const found = new Set<string>();
  for (const s of sections) {
    for (const item of s.items) {
      const text = typeof item === "string" ? item : `${item.title} ${item.text}`;
      for (const m of text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) found.add(m[1]);
    }
  }
  return [...found].sort();
}

export function section(sections: TemplateSection[], key: string) {
  return sections.find((s) => s.key === key);
}
