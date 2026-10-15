/**
 * The pricing rules this build prices and bills with, read the way the
 * server reads them (backend src/services/pricingInputs.js), so the price
 * the server works out inside the analysis and the one the card asks for
 * are made from the same inputs.
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/pricingRules.test.mjs, so what is tested is what the app runs.
 */

/**
 * Sent on every request (apiClient). From this build the server finds the
 * Masters item by the start of the tag number and charges its wastage and
 * labour, and reads each stone's unit and percent labour; builds without
 * the header are priced by the rules their invoices bill.
 */
export const PRICING_RULES_HEADER = 'X-Pricing-Rules';
export const PRICING_RULES = '2';

/** A labour charge's unit: rupees per gram, per 10 g, or a percent of the gold value. */
export type PricingLabourUnit = 'Per Gram' | 'Per 10 Gram' | 'Percent';

/**
 * The first number in a piece of tag text, never below zero (the server's
 * readFigure; formulaUtils.parseNumericValue clamped): commas allowed, a dot
 * straight after a letter ends an abbreviation ('Wt.5.43' is 5.43).
 */
export function readFigure(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.max(0, raw) : 0;
  const text = String(raw);
  const pattern = /\d[\d,]*(?:\.\d+)?|\.\d+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const start = match.index;
    const token = match[0];
    if (token.startsWith('.') && start > 0 && /[A-Za-z]/.test(text[start - 1])) {
      pattern.lastIndex = start + 1;
      continue;
    }
    const value = Number.parseFloat(token.replace(/,/g, ''));
    if (!Number.isFinite(value)) return 0;
    const negative =
      start > 0 && text[start - 1] === '-' && (start === 1 || !/[A-Za-z0-9]/.test(text[start - 2]));
    return Math.max(0, negative ? -value : value);
  }
  return 0;
}

const LABOUR_UNITS: Record<string, PricingLabourUnit> = {
  'per gram': 'Per Gram',
  'per 1 gram': 'Per Gram',
  'per 10 gram': 'Per 10 Gram',
  'per 10 grams': 'Per 10 Gram',
  percent: 'Percent',
  percentage: 'Percent',
  '%': 'Percent',
};

/** 'Per Gram', 'Per 10 Gram' or 'Percent' (any case); null for anything else. */
export function labourUnitOf(raw: unknown): PricingLabourUnit | null {
  return LABOUR_UNITS[String(raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ')] ?? null;
}

/**
 * The labour a tag prints, as the server reads it (parseTagLabour):
 * "850|Per 10 Gram"; "12%" is a percent of the gold value; a plain figure
 * above 100 is rupees per gram (per 10 g when the text says so). A plain
 * figure up to 100 could be either and is left to the item's or the shop's
 * charge, as is text with no number ("NIL"). Null: no labour off the tag.
 */
export function parseTagLabour(raw: string | null | undefined): { amount: number; unit: PricingLabourUnit } | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const parts = text.split('|');
  if (parts.length === 2) {
    const amount = readFigure(parts[0]);
    if (amount > 0) {
      const unit = labourUnitOf(parts[1]);
      if (unit === 'Percent') return amount <= 100 ? { amount, unit } : null;
      return { amount, unit: unit ?? 'Per Gram' };
    }
  }
  const amount = readFigure(text);
  if (!(amount > 0)) return null;
  if (text.includes('%')) return amount <= 100 ? { amount, unit: 'Percent' } : null;
  if (amount > 100) return { amount, unit: /per\s*10\s*gram/i.test(text) ? 'Per 10 Gram' : 'Per Gram' };
  return null;
}

/** A Masters item's labour and its unit (per gram when none was saved); null when the shop gave none. */
export function itemLabourOf(
  item: { labour?: number | null; labourUnit?: string | null } | null | undefined,
): { amount: number; unit: PricingLabourUnit } | null {
  const amount = item?.labour;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return null;
  const unit = labourUnitOf(item?.labourUnit) ?? 'Per Gram';
  if (unit === 'Percent' && amount > 100) return null;
  return { amount, unit };
}

/** The shop's labour charge as GET /rates/labour gives it (null for none, or a saved NONE). */
export interface ShopLabour {
  chargeType: string;
  value: number;
  rupeesUnit?: string;
  weightBasis?: string;
}

export interface PrefilledLabour {
  labourChargeAmount: string;
  labourChargeUnit: PricingLabourUnit;
  labourWeightBasis: 'net' | 'gross';
}

/**
 * What the card's labour box starts with when the tag prints no labour: the
 * Masters item's labour in its unit, else the shop's charge (AMOUNT per its
 * unit, PERCENTAGE as a percent of the gold value), on the weight the shop's
 * charge was saved against. Null: nothing to fill. The server works out the
 * analysis price from exactly this (pricingInputs appLabourFields).
 */
export function prefillLabour(
  item: { labour?: number | null; labourUnit?: string | null } | null | undefined,
  shop: ShopLabour | null | undefined,
  currentBasis: 'net' | 'gross' = 'net',
): PrefilledLabour | null {
  const charge =
    shop && (shop.chargeType === 'AMOUNT' || shop.chargeType === 'PERCENTAGE') && Number.isFinite(shop.value)
      ? shop
      : null;
  const basis = charge ? (charge.weightBasis === 'net' ? 'net' : 'gross') : currentBasis;
  const fromItem = itemLabourOf(item);
  if (fromItem) {
    return {
      labourChargeAmount: String(fromItem.amount),
      labourChargeUnit: fromItem.unit,
      labourWeightBasis: basis,
    };
  }
  if (!charge) return null;
  return {
    labourChargeAmount: String(charge.value),
    labourChargeUnit:
      charge.chargeType === 'PERCENTAGE' ? 'Percent' : charge.rupeesUnit === 'Per 10 Gram' ? 'Per 10 Gram' : 'Per Gram',
    labourWeightBasis: basis,
  };
}

// ── Stones ───────────────────────────────────────────────────────────────

/** Carats in a gram: a stone weight printed in grams is priced as five times as many carats. */
export const CARATS_PER_GRAM = 5;

const GRAM_WORDS = new Set(['g', 'gm', 'gms', 'gr', 'grm', 'grms', 'gram', 'grams', 'gramme', 'grammes']);
const CARAT_WORDS = new Set(['ct', 'cts', 'cr', 'crt', 'crts', 'carat', 'carats', 'karat', 'karats']);

/** "g", "GMS", "Grams" → 'g'; "ct", "CTS", "carat" → 'ct'; anything else null. */
export function stoneUnitOf(raw: unknown): 'g' | 'ct' | null {
  const word = String(raw ?? '').toLowerCase().replace(/[\s.]/g, '');
  if (GRAM_WORDS.has(word)) return 'g';
  if (CARAT_WORDS.has(word)) return 'ct';
  return null;
}

/** The unit written after a stone weight's number: "0.40 g" → 'g', "1.2cts" → 'ct', "0.40" → null. */
export function stoneUnitInText(text: unknown): 'g' | 'ct' | null {
  const match = String(text ?? '').match(/\d(?:[\d.,]*\d)?\s*([a-z]+)/i);
  return match ? stoneUnitOf(match[1]) : null;
}

/** A stone weight's unit: the reader's unit, else one printed after the figure, else carats. */
export function stoneWeightUnit(weightText: unknown, readerUnit?: unknown): 'g' | 'ct' {
  return stoneUnitOf(readerUnit) ?? stoneUnitInText(weightText) ?? 'ct';
}

/** A stone's weight in carats: grams × 5, carats as they are. */
export function caratsOf(weight: number, unit: string | null | undefined): number {
  if (!Number.isFinite(weight) || weight <= 0) return 0;
  return unit === 'g' ? weight * CARATS_PER_GRAM : weight;
}

const lookupKey = (value: unknown) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * The colour-stone rate row a stone matches, as the server matches it
 * (findColorstoneRateMatch): its packet code first (the stone's own, else
 * the tag's); otherwise colour and clarity, on rows without a packet code,
 * and only when the stone has a colour or a clarity at all. Null: the
 * stone's printed rate stands.
 */
export function findColorstoneRateMatch<
  T extends { packetCode?: string | null; color?: string | null; clarity?: string | null },
>(rows: readonly T[], stone: { packetCode?: string; color?: string; clarity?: string }): T | null {
  const packetKey = lookupKey(stone.packetCode);
  if (packetKey) {
    const packetMatch = rows.find((row) => lookupKey(row.packetCode) === packetKey);
    if (packetMatch) return packetMatch;
  }
  const colorKey = lookupKey(stone.color);
  const clarityKey = lookupKey(stone.clarity);
  if (!colorKey && !clarityKey) return null;
  return (
    rows.find(
      (row) =>
        !lookupKey(row.packetCode) && lookupKey(row.color) === colorKey && lookupKey(row.clarity) === clarityKey,
    ) ?? null
  );
}
