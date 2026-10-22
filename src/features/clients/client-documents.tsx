"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { setClientDocument } from "./actions";
import type { ClientDocKind } from "./schemas";

const LABELS: Record<ClientDocKind, string> = { photo: "Photo", cnic_front: "CNIC front", cnic_back: "CNIC back" };
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function DocSlot({
  clientId,
  kind,
  url,
  isPdf,
  canUpload,
}: {
  clientId: string;
  kind: ClientDocKind;
  url?: string;
  isPdf: boolean;
  canUpload: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) return void toast.error("File is larger than 10 MB.");
    if (!ACCEPT.split(",").includes(file.type)) return void toast.error("Use a JPG, PNG, WEBP or PDF file.");
    setBusy(true);
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-60);
      const path = `clients/${clientId}/${crypto.randomUUID()}-${kind}-${safeName}`;
      // Upload straight from the browser; storage RLS checks the user may edit this client.
      const { error } = await createClient().storage.from("client-docs").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const res = await setClientDocument(clientId, kind, path);
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

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{LABELS[kind]}</div>
      <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border bg-muted/40">
        {url ? (
          isPdf ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-sm underline">
              <FileText className="size-8" /> Open PDF
            </a>
          ) : (
            <a href={url} target="_blank" rel="noopener noreferrer" className="h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimisable */}
              <img src={url} alt={LABELS[kind]} className="h-full w-full object-cover" />
            </a>
          )
        ) : (
          <span className="text-xs text-muted-foreground">Not uploaded</span>
        )}
      </div>
      {canUpload && (
        <>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            capture={kind === "photo" ? "user" : "environment"}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <Button type="button" variant="outline" size="sm" className="w-full" disabled={busy} onClick={() => input.current?.click()}>
            <Upload /> {busy ? "Uploading…" : url ? "Replace" : "Upload"}
          </Button>
        </>
      )}
    </div>
  );
}

export function ClientDocuments({
  clientId,
  urls,
  paths,
  canUpload,
}: {
  clientId: string;
  urls: Partial<Record<ClientDocKind, string>>;
  paths: Partial<Record<ClientDocKind, string | null>>;
  canUpload: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {(["photo", "cnic_front", "cnic_back"] as const).map((k) => (
        <DocSlot key={k} clientId={clientId} kind={k} url={urls[k]} isPdf={!!paths[k]?.toLowerCase().endsWith(".pdf")} canUpload={canUpload} />
      ))}
    </div>
  );
}
