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
  | '9k_cash';

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

export const DEFAULT_MATRIX_VALUES: Record<MatrixKey, boolean> = {
  '24k_mcx': true,
  '24k_rtgs': true,
  '24k_cash': true,
  '22k_rtgs': true,
  '22k_cash': true,
  '20k_rtgs': true,
  '20k_cash': true,
  '18k_rtgs': true,
  '18k_cash': true,
  '14k_rtgs': true,
  '14k_cash': true,
  '9k_rtgs': true,
  '9k_cash': true,
};
