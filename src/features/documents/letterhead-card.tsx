"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { setLetterhead } from "./actions";

const MAX_BYTES = 10 * 1024 * 1024;

export function LetterheadCard({ projectId, path, publicUrl }: { projectId: string; path: string | null; publicUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.type !== "application/pdf") return void toast.error("Upload the letterhead as a PDF (A4).");
    if (file.size > MAX_BYTES) return void toast.error("The PDF is larger than 10 MB.");
    setBusy(true);
    try {
      const newPath = `letterheads/${projectId}/${crypto.randomUUID()}.pdf`;
      const { error } = await createClient().storage.from("branding").upload(newPath, file, { contentType: "application/pdf" });
      if (error) throw error;
      const res = await setLetterhead(projectId, newPath);
      if (!res.ok) throw new Error(res.error);
      toast.success(res.message);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    const res = await setLetterhead(projectId, null);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.message);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Letterhead</CardTitle>
        <CardDescription>
          An A4 PDF of the project letterhead. Documents can be printed onto it digitally, or laid out to fit pre-printed
          letterhead paper. Margins below keep text clear of its header, tagline and footer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <FileText className="size-5 text-muted-foreground" />
        <div className="min-w-0 flex-1 text-sm">
          {path ? (
            publicUrl ? (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Current letterhead (PDF)
              </a>
            ) : (
              "Letterhead uploaded"
            )
          ) : (
            <span className="text-muted-foreground">No letterhead — documents use the portal&apos;s plain layout.</span>
          )}
        </div>
        <input ref={input} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          <Upload /> {busy ? "Working…" : path ? "Replace" : "Upload PDF"}
        </Button>
        {path && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
            Remove
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
