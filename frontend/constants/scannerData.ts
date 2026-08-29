import type {
  AbbreviationOption,
  ExtractionField,
  FormulaItem,
  FormulaRule,
  InvoiceLineItem,
  JewelleryType,
  MappedField,
  ScanItemData,
  ScanResultData,
} from '@/types/scanner';
import { DEFAULT_LABOUR_CHARGE_UNIT, DEFAULT_LABOUR_WEIGHT_BASIS } from '@/constants/labour';

export const JEWELLERY_TYPES = ['Gold', 'Diamond'] as const;

export const DEFAULT_SCAN_ITEM: ScanItemData = {
  sku: 'G-1002',
  category: 'Diamond',
  grossWt: '42.500',
  netWt: '38.200',
  pureWt: '34.991',
  tunch: '91.6',
  karat: '22K',
  customPurityPercent: '',
  goldRate: '6500',
  diamondWeight: '1.20',
  diamondColor: 'IJ',
  diamondClarity: 'VSSI',
  diamondQuality: 'IJ VSSI',
  diamondRate: '9500',
  diamondPieces: '4',
  diamondShape: '',
  packetCode: '',
  colorstoneWeight: '',
  colorstoneColor: '',
  colorstoneClarity: '',
  colorstoneQuality: '',
  colorstoneRate: '',
  labourPurityPercent: '',
  labourChargeAmount: '',
  labourChargeUnit: DEFAULT_LABOUR_CHARGE_UNIT,
  labourWeightBasis: DEFAULT_LABOUR_WEIGHT_BASIS,
  calculationRate: 'rtgs',
  otherChargesAmount: '',
  otherChargesItems: [],
  otherChargesRemarks: '',
  diamondAmount: '11,400',
  clubDiamonds: false,
  clubColorstones: false,
  clubbedDiamondsBackup: '',
  clubbedColorstonesBackup: '',
};

export const MOCK_SCAN_RESULT: ScanResultData = {
  netPrice: 184500,
  gstNote: 'Inclusive of 3% GST',
  rawMaterial: {
    type: 'Gold',
    grossWt: '42.500 g',
    netWt: '38.200 g',
    pureWt: '34.991 g',
    tunch: '91.6% (22kt)',
    karat: '22K',
    purityPercent: '91.6%',
  },
  stoneTypes: [
    {
      type: 'Diamond',
      rate: '₹9,590/ct',
      quality: 'VVS1/F',
      weight: '22 ct',
      amount: '₹2,10,980',
    },
  ],
  costSummary: {
    wastage: '1545',
    labour: '₹5,465',
    otherCharges: '₹10,256',
    total: '₹1,85,510',
    goldBase: '₹2,27,442',
    stoneTotal: '₹2,10,980',
  },
};

export const MOCK_EXTRACTION_FIELDS: ExtractionField[] = [
  { id: '1', label: 'SKU Code', value: 'G-1002', status: 'matched' },
  { id: '2', label: 'Gross Weight', value: '42.500 g', status: 'matched' },
  { id: '3', label: 'Net Weight', value: '38.200 g', status: 'matched' },
  { id: '4', label: 'Purity / Tunch', value: '91.6%', status: 'matched' },
  { id: '5', label: 'Diamond Quality', value: 'VVS1/F', status: 'pending' },
  { id: '6', label: 'Carat Weight', value: '1.20 ct', status: 'missing' },
];

export const MOCK_MAPPED_FIELDS: MappedField[] = [
  {
    id: '1',
    label: 'Gross Wt',
    sourceValue: '42.500',
    targetField: 'gross_weight',
    confidence: 98,
  },
  {
    id: '2',
    label: 'Net Wt',
    sourceValue: '38.200',
    targetField: 'net_weight',
    confidence: 95,
  },
  {
    id: '3',
    label: 'Pure Wt',
    sourceValue: '34.991',
    targetField: 'pure_weight',
    confidence: 92,
  },
  {
    id: '4',
    label: 'Tunch',
    sourceValue: '91.6',
    targetField: 'purity_percent',
    confidence: 88,
  },
  {
    id: '5',
    label: 'Diamond Rate',
    sourceValue: '9500',
    targetField: 'diamond_rate',
    confidence: 76,
  },
];

export const MOCK_FORMULAS: FormulaItem[] = [
  {
    id: 'f1',
    name: 'Gold Base Value',
    description: 'Calculates pure gold value from net weight and purity',
    rulesCount: 4,
    lastUsed: '21 May 2024',
    isActive: true,
  },
  {
    id: 'f2',
    name: 'Diamond Valuation',
    description: 'Rate × carat weight with quality multiplier',
    rulesCount: 3,
    lastUsed: '20 May 2024',
    isActive: true,
  },
  {
    id: 'f3',
    name: 'Making Charges',
    description: 'Percentage-based making charge on base value',
    rulesCount: 2,
    lastUsed: '18 May 2024',
    isActive: false,
  },
  {
    id: 'f4',
    name: 'GST Calculation',
    description: 'Applies 3% GST on final amount',
    rulesCount: 1,
    lastUsed: '21 May 2024',
    isActive: true,
  },
];

export const MOCK_FORMULA_RULES: FormulaRule[] = [
  {
    id: 'r1',
    name: 'Pure Weight',
    expression: 'net_weight × (purity_percent / 100)',
    isActive: true,
  },
  {
    id: 'r2',
    name: 'Gold Base Value',
    expression: 'pure_weight × gold_rate_per_gram',
    isActive: true,
  },
  {
    id: 'r3',
    name: 'Diamond Value',
    expression: 'carat_weight × diamond_rate × quality_factor',
    isActive: true,
  },
  {
    id: 'r4',
    name: 'Making Charges',
    expression: 'gold_base_value × 0.12',
    isActive: true,
  },
  {
    id: 'r5',
    name: 'Final Price',
    expression: '(gold_base + diamond_value + making) × 1.03',
    isActive: true,
  },
];

export const MOCK_INVOICE_ITEMS: InvoiceLineItem[] = [
  { description: 'Gold Base Value', amount: 145230 },
  { description: 'Making Charges', amount: 17428 },
  { description: 'Diamond Value', amount: 11400 },
  { description: 'Subtotal', amount: 174058 },
  { description: 'GST (3%)', amount: 10442 },
];

export const FORMULA_EXECUTION_STEPS = [
  { id: '1', label: 'Loading Formula', status: 'completed' as const },
  { id: '2', label: 'Mapping Variables', status: 'completed' as const },
  { id: '3', label: 'Executing Rules', status: 'active' as const },
  { id: '4', label: 'Calculating Price', status: 'pending' as const },
];

export const ACTIVE_FORMULA_STEPS = [
  { id: '1', label: 'Pure Weight Calculation', progress: 100 },
  { id: '2', label: 'Gold Base Value', progress: 100 },
  { id: '3', label: 'Diamond Valuation', progress: 65 },
  { id: '4', label: 'Making Charges', progress: 0 },
  { id: '5', label: 'GST Application', progress: 0 },
];

const COMMON_ABBREVIATIONS = [
  'Gross Wt',
  'Net Wt',
  'Pure Wt',
  'Labour',
  'Other',
] as const;

const COLORSTONE_ABBREVIATIONS = [
  'Colorstone Rate',
  'Colorstone Quality',
  'Colorstone Pieces',
] as const;

export const ABBREVIATION_OPTIONS_BY_TYPE: Record<JewelleryType, readonly AbbreviationOption[]> = {
  Diamond: [
    ...COMMON_ABBREVIATIONS,
    'Diamond Rate',
    'Diamond Quality',
    'Diamond Pieces',
    ...COLORSTONE_ABBREVIATIONS,
  ],
  Gold: [
    ...COMMON_ABBREVIATIONS,
    'Gold Rate',
    'Gold Quality',
    'Gold Pieces',
    ...COLORSTONE_ABBREVIATIONS,
  ],
};

/** @deprecated Use ABBREVIATION_OPTIONS_BY_TYPE */
export const ABBREVIATION_OPTIONS = ABBREVIATION_OPTIONS_BY_TYPE.Gold;

export const MOCK_UNDETECTED_ABBREVIATION = 'GRT';

export const MOCK_REVIEW_RESULTS = {
  grossWt: '',
  netWt: '38.200 g',
  tunch: '91.6 % (22K)',
  diamondWeight: '22',
  diamondColor: 'IJ',
  diamondClarity: 'VSSI',
  diamondPieces: '4',
  diamondRate: '16436',
  diamondQuality: 'IJ VSSI',
  colorstoneWeight: '',
  colorstoneColor: '',
  colorstoneClarity: '',
  colorstoneQuality: '',
  colorstoneRate: '',
  labourPurityPercent: '',
  labourChargeAmount: '5465',
  labourChargeUnit: DEFAULT_LABOUR_CHARGE_UNIT,
  otherChargesAmount: '',
  otherChargesRemarks: '',
};
