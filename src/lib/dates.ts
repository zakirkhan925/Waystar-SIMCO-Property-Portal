import { format, parseISO } from "date-fns";
import { TZDate } from "@date-fns/tz";

export const TIMEZONE = "Asia/Karachi";

type DateInput = string | Date | null | undefined;

function toPk(d: string | Date): TZDate {
  // Plain dates ("2026-10-21") are calendar dates, not instants: don't shift them.
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new TZDate(y, m - 1, day, TIMEZONE);
  }
  const date = typeof d === "string" ? parseISO(d) : d;
  return new TZDate(date, TIMEZONE);
}

/** 21-Oct-2026 */
export function formatDate(d: DateInput): string {
  return d ? format(toPk(d), "dd-MMM-yyyy") : "—";
}

/** 21-Oct-2026 14:05 (Pakistan time) */
export function formatDateTime(d: DateInput): string {
  return d ? format(toPk(d), "dd-MMM-yyyy HH:mm") : "—";
}

/** Today's date in Pakistan as YYYY-MM-DD. */
export function todayPK(): string {
  return format(new TZDate(new Date(), TIMEZONE), "yyyy-MM-dd");
}
