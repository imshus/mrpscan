/**
 * Karat parsing, and reading a number off a tag's text.
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/formulaUtils.test.mjs, so what is tested is what the app runs.
 */

export const ALL_FORMULA_KARATS = ['24K', '22K', '20K', '18K', '14K', '9K'] as const;

/**
 * Every karat a tag may carry and the card can price: the formula karats
 * plus 23K, 21K and 10K. Those three used to be unreadable here, so a 23K or
 * a BIS 958 tag fell to the 14K default and its gold was billed at 58.5%.
 */
export const SCANNABLE_KARATS = ['24K', '23K', '22K', '21K', '20K', '18K', '14K', '10K', '9K'] as const;
const VALID_KARAT_NUMBERS = new Set(SCANNABLE_KARATS.map((karat) => karat.slice(0, -1)));

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
  [417, '10K'],
  [585, '14K'],
  [750, '18K'],
  [833, '20K'],
  [875, '21K'],
  [916, '22K'],
  [958, '23K'],
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

/**
 * The first number written in a piece of tag text: 'Rs. 45,000' → 45000,
 * 'Wt.10.500' → 10.5, '₹87,500/ct' → 87500, '-500' → -500, '.5 ct' → 0.5.
 *
 * Deleting every character that is not a digit or a dot, as this used to,
 * kept the dot of an abbreviation: 'Rs. 45,000' became '.45000', read as
 * 0.45, and 'Wt.10.500' became '.10.500', read as 0.1. A minus counts only
 * when it stands in front of the number, not as a separator after a word
 * ('LBR-850' is 850).
 */
export function parseNumericValue(raw: string | number | undefined | null): number {
  if (raw == null) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const text = String(raw);
  const pattern = /\d[\d,]*(?:\.\d+)?|\.\d+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const start = match.index;
    const token = match[0];
    // A dot straight after a letter ends an abbreviation ('Wt.'); the number
    // starts at the digit after it.
    if (token.startsWith('.') && start > 0 && /[A-Za-z]/.test(text[start - 1])) {
      pattern.lastIndex = start + 1;
      continue;
    }
    const value = Number.parseFloat(token.replace(/,/g, ''));
    if (!Number.isFinite(value)) return 0;
    const negative =
      start > 0 && text[start - 1] === '-' && (start === 1 || !/[A-Za-z0-9]/.test(text[start - 2]));
    return negative ? -value : value;
  }
  return 0;
}

/** A weight off the tag or the card: its first number, never below zero. */
export function parseWeightValue(value: string): number {
  return Math.max(0, parseNumericValue(value));
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
