import Decimal from "decimal.js";

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join("-");
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? belowHundred(r) : ""].filter(Boolean).join(" ");
}

/**
 * Rupee amount in words using the Pakistani system (Crore / Lakh), as used on property documents:
 * 12,500,000 → "One Crore Twenty-Five Lakh". Paisa are appended when present.
 */
export function rupeesInWords(amount: Decimal.Value): string {
  const d = new Decimal(amount).toDecimalPlaces(2);
  if (d.isNegative()) return `Minus ${rupeesInWords(d.abs())}`;
  let n = d.floor().toNumber();
  const paisa = d.minus(d.floor()).times(100).toNumber();
  if (n === 0 && paisa === 0) return "Zero";

  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  // crores above 99 are themselves expressed in words recursively ("One Hundred Twenty Crore")
  if (crore) parts.push(`${crore >= 100 ? rupeesInWords(crore) : belowHundred(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));

  const words = parts.join(" ");
  return paisa ? `${words || "Zero"} and ${belowHundred(paisa)} Paisa` : words;
}
