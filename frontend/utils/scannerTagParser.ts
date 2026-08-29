import type { ParsedScannerTag } from '@/types/scanner';

const SCANNER_TAG_PATTERN = /^([A-Z]{1,3})\|([\d.]+)\|([\d.]+)$/i;

const DIAMOND_PREFIXES = new Set(['RD', 'RB', 'PR', 'EM', 'OV', 'MQ', 'PS', 'AS', 'CU']);

/**
 * Parses scanner tag strings such as:
 * - RD|6.28|5000  → Round Diamond, 6.28 ct, rate 5000
 * - CS|4.26|3000  → Colorstone, 4.26 ct, rate 3000
 */
export function parseScannerTag(input: string): ParsedScannerTag | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(SCANNER_TAG_PATTERN);
  if (!match) return null;

  const [, prefix, weight, rate] = match;
  const normalizedPrefix = prefix.toUpperCase();

  if (normalizedPrefix === 'CS') {
    return {
      stoneType: 'colorstone',
      weight,
      rate,
    };
  }

  if (DIAMOND_PREFIXES.has(normalizedPrefix)) {
    return {
      stoneType: 'diamond',
      shape: normalizedPrefix,
      weight,
      rate,
    };
  }

  return null;
}

export function isValidScannerTag(input: string): boolean {
  return parseScannerTag(input) !== null;
}
