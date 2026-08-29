/**
 * Default charge options that are always available
 * Order is important and should be maintained
 */
export const DEFAULT_CHARGE_OPTIONS = [
  'Hall Marking',
  'HUIV',
  'Certificate',
  'Packing',
  'Insurance',
  'Design',
] as const;

export type DefaultChargeOption = typeof DEFAULT_CHARGE_OPTIONS[number];
