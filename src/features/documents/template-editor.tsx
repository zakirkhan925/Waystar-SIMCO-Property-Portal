"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { placeholdersIn, type ClauseItem, type DocumentTemplate, type TemplateSection } from "@/pdf/template";
import { saveTemplate } from "./actions";
import { PLACEHOLDER_HELP } from "./schemas";

const STYLE_LABEL: Record<TemplateSection["style"], string> = {
  bullets: "Bullet points",
  numbered: "Numbered list",
  paragraphs: "Paragraphs",
  clauses: "Numbered clauses with titles",
};

function move<T>(arr: T[], i: number, d: -1 | 1) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function TemplateEditor({ projectId, template }: { projectId: string; template: DocumentTemplate }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(template.title);
  const [prefix, setPrefix] = useState(template.ref_prefix);
  const [sections, setSections] = useState<TemplateSection[]>(template.sections);
  const [reason, setReason] = useState("");

  const setItems = (si: number, items: ClauseItem[]) =>
    setSections((ss) => ss.map((s, i) => (i === si ? { ...s, items } : s)));

  const used = placeholdersIn(sections);
  const unknown = used.filter((p) => !(p in PLACEHOLDER_HELP));

  const save = () =>
    startTransition(async () => {
      const res = await saveTemplate(projectId, template.doc_type, { title, ref_prefix: prefix, sections, reason });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setReason("");
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Document</CardTitle>
          <CardDescription>
            Currently version {template.version}. Saving creates version {template.version + 1}; documents already issued keep the
            wording they were printed with.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tpl-title">Title</Label>
            <Input id="tpl-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-prefix">Reference prefix</Label>
            <Input id="tpl-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} maxLength={5} />
          </div>
          <div className="sm:col-span-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Placeholders you can use</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(PLACEHOLDER_HELP).map(([k, label]) => (
                <Badge key={k} variant={used.includes(k) ? "secondary" : "outline"} title={label} className="font-mono">
                  {`{{${k}}}`}
                </Badge>
              ))}
            </div>
            {unknown.length > 0 && (
              <p className="mt-2 text-xs text-destructive">
                Unknown placeholders (will print as blanks): {unknown.map((u) => `{{${u}}}`).join(", ")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {sections.map((sec, si) => (
        <Card key={sec.key}>
          <CardHeader className="flex flex-row flex-wrap items-center gap-2 space-y-0">
            <Input
              className="h-8 max-w-xs font-semibold"
              value={sec.heading}
              placeholder="(no heading)"
              aria-label="Section heading"
              onChange={(e) => setSections((ss) => ss.map((s, i) => (i === si ? { ...s, heading: e.target.value } : s)))}
            />
            <span className="text-xs text-muted-foreground">{STYLE_LABEL[sec.style]}</span>
          </CardHeader>
          <CardContent className="space-y-3">
            {sec.items.map((item, ii) => (
              <div key={ii} className="flex gap-2">
                <span className="w-6 shrink-0 pt-2 text-right text-xs text-muted-foreground">{ii + 1}.</span>
                <div className="flex-1 space-y-1.5">
                  {typeof item === "string" ? (
                    <Textarea
                      value={item}
                      rows={Math.min(8, Math.max(2, Math.ceil(item.length / 110)))}
                      aria-label={`Item ${ii + 1}`}
                      onChange={(e) => setItems(si, sec.items.map((x, k) => (k === ii ? e.target.value : x)))}
                    />
                  ) : (
                    <>
                      <Input
                        value={item.title}
                        className="h-8 font-medium"
                        aria-label={`Clause ${ii + 1} title`}
                        onChange={(e) => setItems(si, sec.items.map((x, k) => (k === ii ? { ...item, title: e.target.value } : x)))}
                      />
                      <Textarea
                        value={item.text}
                        rows={Math.min(10, Math.max(2, Math.ceil(item.text.length / 110)))}
                        aria-label={`Clause ${ii + 1} text`}
                        onChange={(e) => setItems(si, sec.items.map((x, k) => (k === ii ? { ...item, text: e.target.value } : x)))}
                      />
                    </>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Move up" onClick={() => setItems(si, move(sec.items, ii, -1))}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Move down" onClick={() => setItems(si, move(sec.items, ii, 1))}>
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove"
                    disabled={sec.items.length === 1}
                    onClick={() => setItems(si, sec.items.filter((_, k) => k !== ii))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems(si, [...sec.items, sec.style === "clauses" ? { title: "New clause", text: "" } : ""])}
            >
              <Plus /> Add {sec.style === "clauses" ? "clause" : "item"}
            </Button>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="tpl-reason">Reason for the change (kept in the activity log)</Label>
            <Input id="tpl-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Legal team revised clause 4" />
          </div>
          <Button onClick={save} disabled={pending || reason.trim().length < 3}>
            {pending ? "Saving…" : "Save new version"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
