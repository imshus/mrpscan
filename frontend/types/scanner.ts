import type { LabourChargeUnit, LabourWeightBasis } from '@/constants/labour';

export type JewelleryType = 'Diamond' | 'Gold';

export type ApiJewelleryType = 'DIAMOND' | 'GOLD';

export type StoneRateType = 'diamond' | 'colorstone';

export type ApiScanType = 'SINGLE_SIDE' | 'BOTH_SIDES';

export type ScanStatus =
  | 'WAITING_FOR_SCAN'
  | 'FRONT_IMAGE_RECEIVED'
  | 'BACK_IMAGE_RECEIVED'
  | 'ANALYSIS_COMPLETED'
  | 'BILLING_FAILED'
  | 'READY_FOR_REVIEW'
  | 'APPROVED';

export type StructuredScanData = Record<string, string>;

export interface CreateScanResponse {
  scanId: string;
  status: ScanStatus;
}

export interface ImageUploadResponse {
  success?: boolean;
  status: ScanStatus;
}

export interface UnknownField {
  abbreviation: string;
  detectedValue?: string;
}

export interface AnalyzeScanResponse {
  success?: boolean;
  scanId: string;
  status: ScanStatus;
  structuredData?: StructuredScanData;
  unknownFields: UnknownField[];
  billing?: {
    billed: boolean;
    /** True while the server finalizes billing in the background (two-step scan). */
    pending?: boolean;
    totalScanCharge?: number;
    billedAt?: string;
  };
}

export interface ClarificationField {
  abbreviation: string;
  detectedValue: string;
  suggestedField: string;
  confidence: number;
  availableFields: string[];
}

export interface ClarificationResponse {
  scanId: string;
  fieldsNeedingReview: ClarificationField[];
}

export interface ConfirmedMapping {
  abbreviation: string;
  mappedField: string;
  description?: string;
}

export interface SubmitClarificationRequest {
  confirmedMappings: ConfirmedMapping[];
}

export interface SubmitClarificationResponse {
  success?: boolean;
  status: ScanStatus;
}

export interface ReviewResponse {
  scanId: string;
  status: ScanStatus;
  structuredData: StructuredScanData;
}

export interface SubmitReviewResponse {
  success?: boolean;
  status: ScanStatus;
}

export enum ScanStage {
  Uploading = 'uploading',
  AIProcessing = 'ai_processing',
  PreparingResults = 'preparing_results',
  Completed = 'completed',
}

/** Where the last scan's time went, in milliseconds. */
export interface ScanTimings {
  uploadMs: number;
  analyzeMs: number;
  totalMs: number;
}

export interface ScanLoadingState {
  stage: ScanStage;
  progress: number;
  message: string;
  /** Set when a scan completes; release builds strip logs, so this is how the split is seen. */
  timings?: ScanTimings;
}

export type OcrProcessingState = 'scanning' | 'processing' | 'success' | 'error';

export type BottomNavRoute = 'home' | 'scanner' | 'ai';

export type ScanMode = 'single' | 'both';

export type ScanSide = 'front' | 'back';

export type AbbreviationOption =
  | 'Gross Wt'
  | 'Net Wt'
  | 'Pure Wt'
  | 'Diamond Rate'
  | 'Diamond Quality'
  | 'Diamond Pieces'
  | 'Gold Rate'
  | 'Gold Quality'
  | 'Gold Pieces'
  | 'Colorstone Rate'
  | 'Colorstone Quality'
  | 'Colorstone Pieces'
  | 'Labour'
  | 'Other';

export interface ScanItemData {
  sku: string;
  category: JewelleryType;
  grossWt: string;
  netWt: string;
  pureWt: string;
  tunch: string;
  karat: string;
  customPurityPercent: string;
  goldRate: string;
  diamondWeight: string;
  diamondColor: string;
  diamondClarity: string;
  diamondQuality: string;
  diamondRate: string;
  diamondPieces: string;
  diamondShape: string;
  packetCode: string;
  colorstoneWeight: string;
  colorstoneColor: string;
  colorstoneClarity: string;
  colorstoneQuality: string;
  colorstoneRate: string;
  labourPurityPercent: string;
  labourChargeAmount: string;
  labourChargeUnit: LabourChargeUnit;
  labourWeightBasis: LabourWeightBasis;
  calculationRate: 'rtgs' | 'cash';
  otherChargesAmount: string;
  otherChargesItems: OtherChargeItem[];
  otherChargesRemarks: string;
  diamondAmount: string;
  clubDiamonds: boolean;
  clubColorstones: boolean;
  clubbedDiamondsBackup: string;
  clubbedColorstonesBackup: string;
}

export interface OtherChargeItem {
  id: string;
  name: string;
  amount: number;
}

export type StoneKind = 'diamond' | 'colorstone';

export interface StoneEntry {
  stoneType: StoneKind;
  weight: string;
  shape?: string;
  packetCode?: string;
  color: string;
  clarity: string;
  quality: string;
  rate: string;
  discountPercent?: string;
  pieces?: string;
}

export interface SequentialStoneBlock {
  sequenceIndex: number;
  displayTitle: string;
  stoneType: StoneKind;
  entry: StoneEntry;
  sourceIndex: number;
}

export interface ParsedScannerTag {
  stoneType: StoneKind;
  shape?: string;
  weight: string;
  rate: string;
}

export interface FormulaRule {
  id: string;
  name: string;
  expression: string;
  isActive: boolean;
}

export interface FormulaItem {
  id: string;
  name: string;
  description: string;
  rulesCount: number;
  lastUsed: string;
  isActive: boolean;
}

export interface InvoiceLineItem {
  description: string;
  amount: number;
}

export interface ScanStoneSummary {
  type: 'Diamond' | 'Colorstone';
  rate: string;
  quality: string;
  weight: string;
  amount: string;
}

export interface ScanResultData {
  netPrice: number;
  gstNote: string;
  rawMaterial: {
    type: JewelleryType;
    grossWt: string;
    netWt: string;
    pureWt: string;
    tunch: string;
    karat: string;
    purityPercent: string;
  };
  stoneTypes: ScanStoneSummary[];
  costSummary: {
    wastage: string;
    labour: string;
    otherCharges: string;
    total: string;
    goldBase: string;
    stoneTotal: string;
  };
}

export interface MappedField {
  id: string;
  label: string;
  sourceValue: string;
  targetField: string;
  confidence: number;
}

export interface ExtractionField {
  id: string;
  label: string;
  value: string;
  status: 'matched' | 'pending' | 'missing';
}

export interface CalculateMrpPayload {
  jewelleryType: string;
  netWt: number;
  grossWt?: number;
  purityKarat: string;
  customPurityPercent?: number;
  labourChargeAmount?: string;
  labourChargeUnit?: string;
  labourWeightBasis?: LabourWeightBasis;
  calculationMode?: 'rtgs' | 'cash';
  otherCharges?: number;
  diamonds: Array<{ weight: number; rate: number; discountPercent?: number }>;
  colorstones: Array<{ weight: number; rate: number }>;
}

export interface CalculateMrpResponse {
  breakdown: {
    diamondAmount: number;
    colorstoneAmount: number;
    pureWeight: number;
    goldRateApplied: number;
    goldAmount: number;
    labourAmount: number;
    labourChargeType: string;
    otherCharges: number;
    subtotal?: number;
  };
  finalMRP: number;
}
