export type LabourChargeUnit = 'Per Gram' | 'Per 10 Gram';
export type LabourWeightBasis = 'gross' | 'net';

export const DEFAULT_LABOUR_CHARGE_UNITS: LabourChargeUnit[] = [
  'Per Gram',
  'Per 10 Gram'
];

export const DEFAULT_LABOUR_CHARGE_UNIT: LabourChargeUnit = 'Per Gram';

export const DEFAULT_LABOUR_WEIGHT_BASIS: LabourWeightBasis = 'gross';

export const LABOUR_WEIGHT_OPTIONS: Array<{ value: LabourWeightBasis; label: string }> = [
  { value: 'gross', label: 'Gross wt' },
  { value: 'net', label: 'Net wt' },
];

export const LABOUR_VALIDATION_MESSAGE =
  'Please enter % Purity or Labour Amount.';

export const LABOUR_SECTION_HINT =
  'Scanner fills one option automatically. You can also enter % Purity or Labour Amount manually.';
