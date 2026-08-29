export const ALL_FORMULA_KARATS = ['24K', '22K', '20K', '18K', '14K', '9K'] as const;
const VALID_KARAT_NUMBERS = new Set(['24', '22', '20', '18', '14', '9']);

export type FormulaKarat = (typeof ALL_FORMULA_KARATS)[number];

export function normalizeKarat(value?: string | null): string {
  if (!value) return '';
  const raw = String(value).trim();
  const withUnit = raw.match(/(\d+)\s*k(?:t)?/i);
  if (withUnit && VALID_KARAT_NUMBERS.has(withUnit[1])) {
    return `${withUnit[1]}K`.toUpperCase();
  }

  const digitsOnly = raw.replace(/[^0-9]/g, '');
  if (VALID_KARAT_NUMBERS.has(digitsOnly) && digitsOnly.length <= 2) {
    return `${digitsOnly}K`;
  }

  return '';
}

export function extractKaratFromTunch(tunch?: string | null): string {
  return normalizeKarat(tunch);
}

export function resolveScannedKarat(karat?: string | null, tunch?: string | null): string {
  const fromKarat = normalizeKarat(karat);
  if (fromKarat) return fromKarat;
  const fromTunch = extractKaratFromTunch(tunch);
  if (fromTunch) return fromTunch;
  // Default to 14K when no karat/tunch information could be extracted from the tag
  return '14K';
}

export function isKaratWhitelisted(karat?: string | null, whitelist: string[] = []): boolean {
  const normalized = normalizeKarat(karat);
  return normalized !== '' && whitelist.includes(normalized);
}

export function getKaratOptionsForEdit(rules: string[], index: number): string[] {
  const occupied = new Set(rules.filter((_, i) => i !== index));
  return ALL_FORMULA_KARATS.filter((karat) => !occupied.has(karat));
}

export function getKaratOptionsForAdd(rules: string[]): string[] {
  return ALL_FORMULA_KARATS.filter((karat) => !rules.includes(karat));
}

export function applyFormula2KaratConstraint(
  scannedKarat: string,
  whitelist: string[],
): { karat: string; requiresDropdown: boolean } {
  if (isKaratWhitelisted(scannedKarat, whitelist)) {
    return { karat: normalizeKarat(scannedKarat), requiresDropdown: false };
  }
  return { karat: '', requiresDropdown: true };
}

export function parseWeightValue(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function computeNetWeightFallback(
  grossWt: string,
  diamondWeight: string,
  colorstoneWeight: string,
): string {
  const gross = parseWeightValue(grossWt);
  const dia = parseWeightValue(diamondWeight);
  const colorstone = parseWeightValue(colorstoneWeight);
  const result = gross - 0.2 * (dia + colorstone);
  if (!Number.isFinite(result)) return '';
  return result > 0 ? result.toFixed(3).replace(/\.?0+$/, '') : '0';
}
