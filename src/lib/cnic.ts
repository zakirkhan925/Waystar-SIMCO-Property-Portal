export const CNIC_REGEX = /^\d{5}-\d{7}-\d$/;

/** Accepts 13 digits with or without dashes and returns 12345-1234567-1, or null if invalid. */
export function normalizeCnic(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 13) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/** 12345-*******-1, for printed / public documents. */
export function maskCnic(cnic: string | null | undefined): string {
  if (!cnic) return "—";
  return cnic.replace(/^(\d{5})-\d{7}-(\d)$/, "$1-*******-$2");
}
