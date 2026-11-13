import type { LabourChargeUnit, LabourWeightBasis } from '@/constants/labour';
import type { WastageWeightBasis } from '@/constants/wastage';

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
  /** Confidence per structured field ("grossWeight", "diamonds.0.weight"), 0-100. */
  fieldConfidence?: Record<string, number>;
  unknownFields: UnknownField[];
  /**
   * Every identifier the reader found on the tag, main one first: the item
   * number it chose and each number it set aside (an SR NO beside the item
   * code). The Item Code and Wastage masters are matched against all of
   * them. Empty from a server that does not send it yet.
   */
  tagIdentifiers?: string[];
  /**
   * The Masters -> Labour Code the server matched on the tag, when it names
   * one ('' or absent: none); the analysis' price records it as well, but
   * only this names it when the analysis could not price (pricing null).
   * analyzeScan always carries it, trimmed ('' for none or a server that
   * does not send it); the demo answer leaves it out.
   */
  labourCode?: string;
  billing?: {
    billed: boolean;
    /** True while the server finalizes billing in the background (two-step scan). */
    pending?: boolean;
    totalScanCharge?: number;
    billedAt?: string;
  };
  /**
   * The MRP the server computed for this reading in the same call, so the
   * review card can show a price the instant it shows the values. Null when
   * the server could not price it; the card then prices itself.
   */
  pricing?: CalculateMrpResponse | null;
  /**
   * Why the analysis has no price, when it is a reason the card can say: no
   * live gold rate (RATES_UNAVAILABLE) or a reading that cannot be priced.
   */
  pricingError?: { code: string; message: string } | null;
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
  /**
   * The catalogue name behind the tag's item code (Masters → Item Code),
   * attached when the code matches; empty when it does not.
   */
  itemName: string;
  /**
   * The saved item code the tag's number matched, or the one chosen by hand.
   * Held apart from `sku` so naming a piece never rewrites the number the
   * tag was printed with. Empty when no saved code matches.
   */
  itemCode: string;
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
  /**
   * The Masters → Labour Code picked for this scan; picking it fills
   * labourChargeAmount and labourChargeUnit with the code's rate and unit.
   */
  labourCode?: string;
  /**
   * A wastage % typed on the review screen for this scan alone. Empty means
   * the item master's own figure applies; the server treats a sent value as
   * the override.
   */
  wastagePercent?: string;
  /** The Masters → Wastage code picked for this scan; its percent fills wastagePercent. */
  wastageCode?: string;
  /** The weight the wastage percent is taken of; net unless picked on the Wastage tile. */
  wastageWeightBasis: WastageWeightBasis;
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
  /**
   * The unit the weight was printed in: 'g' (priced as 5 ct a gram) or
   * 'ct'. Absent on rows saved before units were read: carats.
   */
  unit?: 'g' | 'ct';
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
  /** The shop's item code for this piece: what its wastage is kept against. */
  itemCode?: string;
  /** Every identifier on the tag, so a Masters -> Wastage code printed anywhere on it is found. */
  tagIdentifiers?: string[];
  /** Overrides the item's own wastage, for a piece that is an exception. */
  wastagePercent?: number;
  /** A Masters -> Wastage code picked on the card: used ahead of the tag's own. */
  wastageCode?: string;
  /**
   * A Masters -> Labour Code picked on the card: found ahead of the tag's own.
   * A labour figure sent alongside (labourChargeAmount) still beats its rate.
   */
  labourCode?: string;
  /** The weight the wastage percent is taken of (pricing rules 3; the server's default is net). */
  wastageWeightBasis?: WastageWeightBasis;
  /** `unit`: the weight's unit, 'ct' or 'g' (5 ct a gram). */
  diamonds: Array<{ weight: number; rate: number; discountPercent?: number; unit?: 'g' | 'ct' }>;
  colorstones: Array<{ weight: number; rate: number; unit?: 'g' | 'ct' }>;
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
    /** The Masters -> Labour Code picked or matched on the tag; blank when none. */
    labourCode?: string;
    /** Blank when the item carries no wastage, so the tile stays empty. */
    wastageCode?: string;
    wastagePercent?: number;
    /** The weight the percent was taken of; absent from a server before pricing rules 3. */
    wastageWeightBasis?: WastageWeightBasis;
    /** The weight × the percent: the grams the invoice's wastage line bills. */
    wastageWeightGrams?: number;
    /**
     * The rate per gram the wastage grams were priced at: the Gold tile's
     * Current Gold Rate per gram (the 24K rate × the purity). Absent from a
     * server before pricing rules 3, which priced them at the 24K rate.
     */
    wastageRatePerGram?: number;
    wastageAmount?: number;
    otherCharges: number;
    subtotal?: number;
    /** The net weight the gold was priced on: the gross less the stones when none was given. */
    netWeightUsed?: number;
    /** True when netWeightUsed was worked out from the gross weight (low confidence). */
    netWeightEstimated?: boolean;
  };
  finalMRP: number;
  /** finalMRP to the rupee, half-up. */
  finalMRPRounded?: number;
}
