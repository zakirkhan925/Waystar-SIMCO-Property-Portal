"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { installTemplateSet } from "./actions";

export function InstallTemplatesButton({ projectId, label }: { projectId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await installTemplateSet(projectId, "plot_society_simco");
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        })
      }
    >
      {pending ? "Installing…" : label}
    </Button>
  );
}
