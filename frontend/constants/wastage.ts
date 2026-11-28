import { LABOUR_WEIGHT_OPTIONS, type LabourWeightBasis } from '@/constants/labour';

/**
 * The weight a wastage percent is taken of: the net weight (the metal
 * alone) unless the shop picks the gross weight on the Wastage tile. The
 * same two choices as Labour's Weight Used, and gross falls back to net when
 * the tag gives no gross weight, as the server does.
 */
export type WastageWeightBasis = LabourWeightBasis | 'gold_diamond';

export const DEFAULT_WASTAGE_WEIGHT_BASIS: WastageWeightBasis = 'net';

/**
 * Gross Wt, Net Wt, and Gold + DMD (owner, 28 Nov 2026): the percent of the
 * gold amount plus the diamond amount, as the server prices it.
 */
export const WASTAGE_WEIGHT_OPTIONS: Array<{ value: WastageWeightBasis; label: string }> = [
  ...LABOUR_WEIGHT_OPTIONS,
  { value: 'gold_diamond', label: 'Gold + DMD' },
];

export function isWastageWeightBasis(value: unknown): value is WastageWeightBasis {
  return value === 'gross' || value === 'net' || value === 'gold_diamond';
}
