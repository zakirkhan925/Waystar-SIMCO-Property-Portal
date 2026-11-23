import { z } from "zod";
import { parseMoney, toDecimal } from "@/lib/money";
import { Constants } from "@/types/database";

const money = z.string().transform((value, ctx) => {
  const parsed = parseMoney(value);
  if (parsed === null) {
    ctx.addIssue({ code: "custom", message: "Enter an amount with up to two decimal places." });
    return z.NEVER;
  }
  return parsed;
});
export const positiveAmount = money.refine((value) => toDecimal(value).gt(0), "Enter a positive amount.");
export const reason = z.string().trim().min(1, "Enter a reason.").max(500);
export const mode = z.enum(Constants.public.Enums.payment_mode);
const pct = money.refine((value) => toDecimal(value).gte(0) && toDecimal(value).lte(100), "Enter 0 to 100.");
const optionalId = z.union([z.uuid(), z.literal("")]).transform((value) => value || null);
const dates = {
  start_date: z.iso.date(),
  end_date: z.iso.date(),
};
const terms = {
  ...dates,
  monthly_rent: money.refine((value) => toDecimal(value).gte(1), "Enter at least one rupee."),
  security_deposit: money.refine((value) => toDecimal(value).gte(0), "Enter zero or a positive amount."),
  rent_due_day: z.coerce.number().int().min(1).max(28),
  increment_pct: pct,
  commission_pct: pct,
  notes: z.string().trim().max(2000),
};

export const leaseSchema = z.object({
  ...terms,
  unit_id: z.uuid(),
  tenant_client_id: z.uuid("Choose a tenant."),
  landlord_client_id: optionalId,
  agent_id: optionalId,
  dealer_id: optionalId,
}).refine((value) => value.end_date >= value.start_date, "The end date must be on or after the start date.");

const moneyDate = { amount: positiveAmount, mode };
const amountReason = { amount: positiveAmount, reason };
const target = { target: z.uuid() };

export const leaseChangeSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("payment"), ...moneyDate, received_on: z.iso.date(),
    bank_name: z.string(), instrument_no: z.string(), instrument_date: z.union([z.iso.date(), z.literal("")]), notes: z.string() }),
  z.object({ intent: z.literal("clear"), ...target, date: z.iso.date() }),
  z.object({ intent: z.literal("bounce"), ...target, reason }),
  z.object({ intent: z.literal("reverse"), ...target, reason }),
  z.object({ intent: z.literal("penalty"), ...target, ...amountReason }),
  z.object({ intent: z.literal("waive"), ...target, ...amountReason }),
  z.object({ intent: z.literal("deposit"), amount: money, txn_date: z.iso.date(),
    type: z.enum(Constants.public.Enums.deposit_txn_type), reason, reference_no: z.string() }),
  z.object({ intent: z.literal("payout"), ...moneyDate, paid_on: z.iso.date(), reference_no: reason }),
  z.object({ intent: z.literal("reversePayout"), ...target, reason }),
  z.object({ intent: z.literal("terminate"), date: z.iso.date(), reason }),
  z.object({ intent: z.literal("renew"), ...terms }),
]);

export type LeaseIntent = z.input<typeof leaseChangeSchema>["intent"];
