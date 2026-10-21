import Decimal from "decimal.js";

// Money is never handled as a JS float: amounts arrive from Postgres numeric as strings.
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = Decimal.Value | null | undefined;

export function toDecimal(v: MoneyInput): Decimal {
  if (v === null || v === undefined || v === "") return new Decimal(0);
  return new Decimal(v);
}

/** `Rs 1,250,000` (no decimals unless there are paisa). */
export function formatPKR(v: MoneyInput, opts: { decimals?: boolean } = {}): string {
  const d = toDecimal(v);
  const negative = d.isNegative();
  const abs = d.abs();
  const showDecimals = opts.decimals ?? !abs.isInteger();
  const [int, frac] = abs.toFixed(showDecimals ? 2 : 0).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}Rs ${grouped}${frac ? `.${frac}` : ""}`;
}

/** Compact form for dashboards: Rs 1.25 Cr / Rs 45.5 Lac / Rs 85,000. */
export function formatPKRShort(v: MoneyInput): string {
  const d = toDecimal(v);
  const abs = d.abs();
  const sign = d.isNegative() ? "-" : "";
  if (abs.gte(10_000_000)) return `${sign}Rs ${trim(abs.div(10_000_000))} Cr`;
  if (abs.gte(100_000)) return `${sign}Rs ${trim(abs.div(100_000))} Lac`;
  return formatPKR(d);
}

function trim(d: Decimal) {
  return d.toDecimalPlaces(2).toString();
}

/** Parse user input like "1,250,000" or "Rs 1,250,000.50" into a numeric string for Postgres. */
export function parseMoney(input: string): string | null {
  const cleaned = input.replace(/rs\.?/i, "").replace(/[,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return new Decimal(cleaned).toFixed(2);
}
