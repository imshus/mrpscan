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

/**
 * Fineness, as tags print it, and the karat each value denotes. A tag saying
 * 750 and a tag saying 18K describe the same metal, so they must price the
 * same; without this a 750 tag fell through to the 14K default and its gold
 * was valued at 58.5% purity instead of 75%.
 */
const FINENESS_STANDARDS: ReadonlyArray<readonly [number, string]> = [
  [375, '9K'],
  [585, '14K'],
  [750, '18K'],
  [833, '20K'],
  [916, '22K'],
  [999, '24K'],
];
/** Parts per thousand a printed value may sit from a standard and still mean it. */
const FINENESS_TOLERANCE = 20;

/** '750' / '75' / '91.6' → the karat printed as fineness, or '' when it is none. */
export function karatFromFineness(value?: string | null): string {
  const digits = String(value ?? '').replace(/[^0-9.]/g, '');
  if (!digits) return '';
  const parsed = Number.parseFloat(digits);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  // 75 and 75.0 are the percentage form of the same fineness as 750.
  const perMille = parsed <= 100 ? parsed * 10 : parsed;
  if (perMille < 300 || perMille > 1000) return '';

  let closest = '';
  let distance = Number.POSITIVE_INFINITY;
  for (const [standard, karat] of FINENESS_STANDARDS) {
    const gap = Math.abs(perMille - standard);
    if (gap < distance) {
      distance = gap;
      closest = karat;
    }
  }
  return distance <= FINENESS_TOLERANCE ? closest : '';
}

export function extractKaratFromTunch(tunch?: string | null): string {
  return normalizeKarat(tunch) || karatFromFineness(tunch);
}

/**
 * The karat the tag actually carries, or '' when it carries none. Callers that
 * must show something use resolveScannedKarat; this one lets them tell a
 * reading from a default.
 */
export function readScannedKarat(karat?: string | null, tunch?: string | null): string {
  return (
    normalizeKarat(karat) ||
    extractKaratFromTunch(tunch) ||
    karatFromFineness(karat)
  );
}

export function resolveScannedKarat(karat?: string | null, tunch?: string | null): string {
  // Default to 14K when no karat/tunch information could be extracted from the tag
  return readScannedKarat(karat, tunch) || '14K';
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
