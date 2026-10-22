"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDelete } from "@/components/confirm-delete";
import type { ActionResult } from "@/lib/action-result";
import { addBlock, addFloors, deleteBlock, deleteFloor, renameBlock } from "./actions";
import type { ProjectStructure } from "./queries";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      after?.();
      router.refresh();
    });
  return { run, pending };
}

function FloorsAdder({ blockId }: { blockId: string }) {
  const { run, pending } = useRun();
  const [basements, setBasements] = useState("1");
  const [ground, setGround] = useState(true);
  const [mezz, setMezz] = useState(false);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("10");
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md bg-muted/40 p-3 text-sm">
      <div className="space-y-1">
        <Label htmlFor={`b-${blockId}`}>Basements</Label>
        <Input id={`b-${blockId}`} className="h-8 w-16" inputMode="numeric" value={basements} onChange={(e) => setBasements(e.target.value)} />
      </div>
      <label className="flex h-8 items-center gap-2">
        <Checkbox checked={ground} onCheckedChange={(c) => setGround(c === true)} /> Ground
      </label>
      <label className="flex h-8 items-center gap-2">
        <Checkbox checked={mezz} onCheckedChange={(c) => setMezz(c === true)} /> Mezzanine
      </label>
      <div className="space-y-1">
        <Label htmlFor={`f-${blockId}`}>Floors from</Label>
        <Input id={`f-${blockId}`} className="h-8 w-16" inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`t-${blockId}`}>to</Label>
        <Input id={`t-${blockId}`} className="h-8 w-16" inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button
        size="sm"
        disabled={pending}
        onClick={() => run(() => addFloors(blockId, { basements, ground, mezzanine: mezz, from, to }))}
      >
        <Plus /> Add floors
      </Button>
    </div>
  );
}

function BlockCard({ block, isPlotSociety, canDelete }: { block: ProjectStructure[number]; isPlotSociety: boolean; canDelete: boolean }) {
  const { run, pending } = useRun();
  const [name, setName] = useState(block.name);


  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-8 w-48" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
        {name !== block.name && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => renameBlock(block.id, name))}>
            Save name
          </Button>
        )}
        <span className="text-xs capitalize text-muted-foreground">{block.kind}</span>
        {canDelete && (
          <div className="ml-auto">
            <ConfirmDelete
              title={`Delete ${block.name}?`}
              description="Only empty blocks/towers can be deleted."
              action={(r) => deleteBlock(block.id, r)}
              trigger={
                <Button size="icon-sm" variant="ghost" aria-label={`Delete ${block.name}`}>
                  <Trash2 />
                </Button>
              }
            />
          </div>
        )}
      </div>
      {!isPlotSociety && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {block.floors.length === 0 && <span className="text-xs text-muted-foreground">No floors yet.</span>}
            {block.floors.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs">
                {f.label}
                {canDelete && (
                  <ConfirmDelete
                    title={`Delete floor ${f.label}?`}
                    description="Only empty floors can be deleted."
                    action={(r) => deleteFloor(f.id, r)}
                    trigger={
                      <button type="button" className="text-muted-foreground hover:text-destructive" aria-label={`Delete floor ${f.label}`}>
                        ×
                      </button>
                    }
                  />
                )}
              </span>
            ))}
          </div>
          <FloorsAdder blockId={block.id} />
        </>
      )}
    </div>
  );
}

export function StructureEditor({
  projectId,
  isPlotSociety,
  structure,
  canDelete,
}: {
  projectId: string;
  isPlotSociety: boolean;
  structure: ProjectStructure;
  canDelete: boolean;
}) {
  const { run, pending } = useRun();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"block" | "tower" | "phase" | "sector">(isPlotSociety ? "block" : "tower");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isPlotSociety ? "Blocks" : "Towers & floors"}</CardTitle>
        <CardDescription>
          {isPlotSociety ? "Plots are numbered by block and street." : "Units are placed on a tower floor."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {structure.map((b) => (
          <BlockCard key={b.id} block={b} isPlotSociety={isPlotSociety} canDelete={canDelete} />
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-8 w-48"
            placeholder={isPlotSociety ? "Block D" : "Tower B"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New block or tower name"
          />
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger size="sm" className="w-28" aria-label="Kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="block">Block</SelectItem>
              <SelectItem value="tower">Tower</SelectItem>
              <SelectItem value="phase">Phase</SelectItem>
              <SelectItem value="sector">Sector</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" disabled={pending || !name.trim()} onClick={() => run(() => addBlock(projectId, { name, kind }), () => setName(""))}>
            <Plus /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
