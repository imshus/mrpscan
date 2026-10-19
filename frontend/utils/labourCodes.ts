/**
 * Masters → Labour Code: a short code the shop uses for a kind of making and
 * the labour rate that goes with it (LB-03 → ₹415 a gram), the labour
 * counterpart of Masters → Wastage. Picking a code on the review card fills
 * its Labour Rate (and the unit the rate is in) and the server prices and
 * records it; a code printed on the tag is matched by the server.
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/labourCodes.test.mjs, so what is tested is what the app runs.
 */

/** Rupees per gram, rupees per 10 g, or a percent of the gold value (constants/labour LabourChargeUnit). */
export type LabourCodeUnit = 'Per Gram' | 'Per 10 Gram' | 'Percent';

export const LABOUR_CODE_UNITS: LabourCodeUnit[] = ['Per Gram', 'Per 10 Gram', 'Percent'];

/** The server's own default: a code saved without a unit is rupees per gram. */
export const DEFAULT_LABOUR_CODE_UNIT: LabourCodeUnit = 'Per Gram';

/** The longest code the server keeps. */
export const LABOUR_CODE_MAX_LENGTH = 20;

/** One line of Masters → Labour Code. */
export interface LabourCode {
  id: string;
  code: string;
  /** Null only for a row the server answers without a figure: nothing to fill. */
  rate: number | null;
  unit: LabourCodeUnit;
}

export type RawLabourCode = {
  _id?: string;
  id?: string;
  code?: string;
  rate?: number | string | null;
  unit?: string | null;
};

/** 'Per Gram', 'per 10 gram', 'PERCENT' → the unit; anything else is the default, per gram. */
export function labourCodeUnitOf(raw: unknown): LabourCodeUnit {
  const text = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const unit = LABOUR_CODE_UNITS.find((candidate) => candidate.toLowerCase() === text);
  return unit ?? DEFAULT_LABOUR_CODE_UNIT;
}

function toOptionalRate(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** A row as GET/POST /labour-codes answers it; null when it has no id or no code. */
export function toLabourCode(raw: RawLabourCode | null | undefined): LabourCode | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? raw._id ?? '').trim();
  const code = String(raw.code ?? '').trim();
  if (!id || !code) return null;
  return { id, code, rate: toOptionalRate(raw.rate), unit: labourCodeUnitOf(raw.unit) };
}

/**
 * Codes compared on their letters and digits alone, as the server matches
 * them (wastageResolution codeKey): "LB 03", "lb-03" and "LB03" are one code.
 */
export function labourCodeKey(value: unknown): string {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** The saved row a code names (a picked one, or the one the server matched); null when none. */
export function findLabourCode(
  codes: readonly LabourCode[] | null | undefined,
  code: string | null | undefined,
): LabourCode | null {
  const key = labourCodeKey(code);
  if (!key || !codes?.length) return null;
  return codes.find((row) => labourCodeKey(row.code) === key) ?? null;
}

/**
 * What picking a code puts in the Labour tile: its rate in the Labour Rate
 * box and the unit that rate is in. Null when the row has no usable figure
 * (none given, or a percent above 100): the box then keeps what it holds.
 */
export function labourFromCode(
  row: Pick<LabourCode, 'rate' | 'unit'> | null | undefined,
): { labourChargeAmount: string; labourChargeUnit: LabourCodeUnit } | null {
  if (!row || row.rate === null || !Number.isFinite(row.rate) || row.rate < 0) return null;
  if (row.unit === 'Percent' && row.rate > 100) return null;
  return { labourChargeAmount: String(row.rate), labourChargeUnit: row.unit };
}

/**
 * The labour code the analysis matched on the tag, when the server names
 * one: its own field, else the code its price recorded. '' when none.
 */
export function analysisLabourCode(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const record = result as { labourCode?: unknown; pricing?: { breakdown?: { labourCode?: unknown } } | null };
  const own = typeof record.labourCode === 'string' ? record.labourCode.trim() : '';
  if (own) return own;
  const priced = record.pricing?.breakdown?.labourCode;
  return typeof priced === 'string' ? priced.trim() : '';
}

/** A rate as typed on Masters: digits and one point, nothing else. */
export function cleanLabourCodeRate(text: string): string {
  return text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
}

/**
 * Why a Masters line cannot be saved, or null when it can: a code is needed,
 * at most 20 characters. The rate may be left blank, as a Wastage % may (the
 * server keeps no figure, and picking the code then fills nothing); a rate
 * given is a number, never below zero, and a percent of the gold value is
 * at most 100.
 */
export function labourCodeLineError(code: string, rate: string, unit: LabourCodeUnit): string | null {
  const trimmedCode = code.trim();
  if (!trimmedCode) return 'Enter the labour code first.';
  if (trimmedCode.length > LABOUR_CODE_MAX_LENGTH) {
    return `A labour code is at most ${LABOUR_CODE_MAX_LENGTH} characters.`;
  }
  const trimmedRate = rate.trim();
  if (!trimmedRate) return null;
  const figure = Number(trimmedRate);
  if (!Number.isFinite(figure) || figure < 0) return 'The labour rate must be a number, 0 or more.';
  if (unit === 'Percent' && figure > 100) return 'A labour percentage must be between 0 and 100.';
  return null;
}
