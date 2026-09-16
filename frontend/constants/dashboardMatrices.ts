export type MatrixKey =
  | '24k_mcx'
  | '24k_rtgs'
  | '24k_cash'
  | '22k_rtgs'
  | '22k_cash'
  | '20k_rtgs'
  | '20k_cash'
  | '18k_rtgs'
  | '18k_cash'
  | '14k_rtgs'
  | '14k_cash'
  | '9k_rtgs'
  | '9k_cash'
  | 'bhaw_source_jmd';

export interface MatrixRow {
  key: MatrixKey;
  label: string;
}

export interface MatrixSection {
  sectionLabel: string;
  rows: MatrixRow[];
}

export const GOLD_MATRIX_SECTIONS: MatrixSection[] = [
  {
    sectionLabel: '24K GOLD',
    rows: [
      { key: '24k_mcx', label: ' MCX Rate ' },
      { key: '24k_rtgs', label: ' RTGS Rate ' },
      { key: '24k_cash', label: ' Cash Rate ' },
    ],
  },
  {
    sectionLabel: '22K GOLD',
    rows: [
      { key: '22k_rtgs', label: ' RTGS Rate ' },
      { key: '22k_cash', label: ' Cash Rate ' },
    ],
  },
  {
    sectionLabel: '20K GOLD',
    rows: [
      { key: '20k_rtgs', label: ' RTGS Rate ' },
      { key: '20k_cash', label: ' Cash Rate ' },
    ],
  },
  {
    sectionLabel: '18K GOLD',
    rows: [
      { key: '18k_rtgs', label: ' RTGS Rate ' },
      { key: '18k_cash', label: ' Cash Rate ' },
    ],
  },
  {
    sectionLabel: '14K GOLD',
    rows: [
      { key: '14k_rtgs', label: ' RTGS Rate ' },
      { key: '14k_cash', label: ' Cash Rate ' },
    ],
  },
  {
    sectionLabel: '9K GOLD',
    rows: [
      { key: '9k_rtgs', label: ' RTGS Rate ' },
      { key: '9k_cash', label: ' Cash Rate ' },
    ],
  },
];

/**
 * What Home shows when nothing at all is selected. A blank dashboard is how
 * an abandoned record reads, not a choice, so the shop's headline price comes
 * back — 24K MCX, RTGS and Cash.
 */
export const OPENING_MATRIX_KEYS: MatrixKey[] = ['24k_mcx', '24k_rtgs', '24k_cash'];

/**
 * The rates Home should show for these settings. Everything selected is kept
 * as it is; a set with nothing selected at all gets the 24K rates back, so
 * opening the app never lands on a dashboard with no price on it.
 */
export function withOpeningDefaults(
  values: Record<string, boolean>,
): Record<MatrixKey, boolean> {
  const merged = { ...DEFAULT_MATRIX_VALUES, ...values } as Record<MatrixKey, boolean>;
  const anyRateOn = (Object.keys(merged) as MatrixKey[]).some(
    (key) => key !== 'bhaw_source_jmd' && merged[key],
  );
  if (!anyRateOn) {
    for (const key of OPENING_MATRIX_KEYS) merged[key] = true;
  }
  return merged;
}

/**
 * What a shop that has saved nothing sees: the 24K price alone. The lighter
 * karats are in the Choose Karat menu, off until they are ticked — a new
 * dashboard opens on one price rather than six cards of them.
 */
export const DEFAULT_MATRIX_VALUES: Record<MatrixKey, boolean> = {
  '24k_mcx': true,
  '24k_rtgs': true,
  '24k_cash': true,
  '22k_rtgs': false,
  '22k_cash': false,
  '20k_rtgs': false,
  '20k_cash': false,
  '18k_rtgs': false,
  '18k_cash': false,
  '14k_rtgs': false,
  '14k_cash': false,
  '9k_rtgs': false,
  '9k_cash': false,
  // Bhaw rate source: true = JMD Patil live feed, false = Mega Bullion.
  'bhaw_source_jmd': false,
};
