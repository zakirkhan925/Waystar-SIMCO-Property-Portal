"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UNIT_STATUS_LABELS, type UnitStatus } from "@/lib/labels";
import { changeUnitStatus } from "./actions";

const MANUAL = ["available", "on_hold", "blocked"] as const;

export function UnitStatusDialog({ unitId, current }: { unitId: string; current: UnitStatus }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<(typeof MANUAL)[number]>(current === "available" ? "on_hold" : "available");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const res = await changeUnitStatus(unitId, { status, reason });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      setReason("");
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Change status
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change unit status</DialogTitle>
          <DialogDescription>
            Currently <strong>{UNIT_STATUS_LABELS[current]}</strong>. Booked, sold and rented are set automatically by sales and leases.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="new-status">New status</FieldLabel>
          <Select value={status} onValueChange={(v) => setStatus(v as (typeof MANUAL)[number])}>
            <SelectTrigger id="new-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MANUAL.filter((s) => s !== current).map((s) => (
                <SelectItem key={s} value={s}>
                  {UNIT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="status-reason">Reason</FieldLabel>
          <Textarea id="status-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Reserved for SIMCO management" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || reason.trim().length < 3}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
