"use client";

import { ChevronDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DOCUMENTS = [
  ["booking_form", "Booking Form"],
  ["allotment_letter", "Allotment Letter"],
  ["sale_agreement", "Sale Agreement"],
  ["installment_schedule", "Installment Payment Schedule"],
  ["possession_letter", "Possession Letter"],
  ["ndc_letter", "No Dues Certificate"],
] as const;

/** Only offers what is true right now: no NDC while money is owed, no letter before handover. */
export function SaleDocumentsMenu({
  saleId,
  hasPossession,
  isSettled,
}: {
  saleId: string;
  hasPossession: boolean;
  isSettled: boolean;
}) {
  const available = DOCUMENTS.filter(([doc]) => {
    if (doc === "possession_letter") return hasPossession;
    if (doc === "ndc_letter") return isSettled;
    return true;
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText /> Documents <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {available.map(([doc, label]) => (
          <DropdownMenuItem key={doc} asChild>
            <a href={`/api/pdf/sale/${saleId}/${doc}`} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
