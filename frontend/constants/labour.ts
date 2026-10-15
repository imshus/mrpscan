/**
 * Rupees per gram, rupees per 10 g, or a percent of the gold value (a tag's
 * "12%", an item saved in percent, or a PERCENTAGE shop charge).
 */
export type LabourChargeUnit = 'Per Gram' | 'Per 10 Gram' | 'Percent';
export type LabourWeightBasis = 'gross' | 'net';

/** The rupee units. */
export const DEFAULT_LABOUR_CHARGE_UNITS: LabourChargeUnit[] = [
  'Per Gram',
  'Per 10 Gram'
];

/** Every unit a labour figure may be in, as the server reads labourChargeUnit. */
export const LABOUR_CHARGE_UNITS: LabourChargeUnit[] = ['Per Gram', 'Per 10 Gram', 'Percent'];

export const DEFAULT_LABOUR_CHARGE_UNIT: LabourChargeUnit = 'Per Gram';

export const DEFAULT_LABOUR_WEIGHT_BASIS: LabourWeightBasis = 'net';

export const LABOUR_WEIGHT_OPTIONS: Array<{ value: LabourWeightBasis; label: string }> = [
  { value: 'net', label: 'Net wt' },
  { value: 'gross', label: 'Gross wt' },
];

export const LABOUR_VALIDATION_MESSAGE =
  'Please enter % Purity or Labour Amount.';

export const LABOUR_SECTION_HINT =
  'Scanner fills one option automatically. You can also enter % Purity or Labour Amount manually.';
