import { LABOUR_WEIGHT_OPTIONS, type LabourWeightBasis } from '@/constants/labour';

/**
 * The weight a wastage percent is taken of: the net weight (the metal
 * alone) unless the shop picks the gross weight on the Wastage tile. The
 * same two choices as Labour's Weight Used, and gross falls back to net when
 * the tag gives no gross weight, as the server does.
 */
export type WastageWeightBasis = LabourWeightBasis;

export const DEFAULT_WASTAGE_WEIGHT_BASIS: WastageWeightBasis = 'net';

export const WASTAGE_WEIGHT_OPTIONS = LABOUR_WEIGHT_OPTIONS;
