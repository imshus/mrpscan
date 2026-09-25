import type { LabourWeightBasis } from '@/constants/labour';

export type GoldIncreaseByType = 'FLAT' | 'PERCENTAGE';

export type GoldCarat = '22Kt' | '20Kt' | '18Kt' | '14Kt' | '9Kt';

export type McxChangeOperation = '+' | '-';

export interface McxChange {
  operation: McxChangeOperation;
  amount: number;
}

export interface GoldRate {
  id?: string;
  carat: GoldCarat | string;
  purity: number;
  finalRate: number;
  isHidden?: boolean;
  increaseByAmount?: number;
  increaseByType?: GoldIncreaseByType;
  baseRate?: number;
  mcxRate?: number;
  cashRate?: number;
  rtgsRate?: number;
}

export interface TaxSettings {
  mcxChange?: McxChange;
  mcxChangeBy?: number;
  mcxFinalRate?: number;
  rtgsChangeBy: number;
  cashChangeBy: number;
  scannerCalculationUse: 'rtgs' | 'cash';
  /** The percent RTGS Rate 2 carries; RTGS Rate 1 carries none. */
  rtgsTaxPercent?: number;
  /** Which RTGS rate the app prices on: 'taxed' (Rate 1) or 'plain' (Rate 2). */
  rtgsVariant?: 'taxed' | 'plain';
  rtgsRate1FinalRate?: number;
  rtgsRate2FinalRate?: number;
  rtgsFinalRate?: number;
  cashFinalRate?: number;
  /**
   * The MCX the server built this shop's RTGS and Cash on, before the shop's
   * own MCX change: the followed house's own line while its bhaw is live,
   * else the market MCX. Absent from servers older than the majority MCX.
   */
  pricingMcxLiveRate?: number;
}

export interface SupremeChanges {
  rtgsChange: number;
  cashChange: number;
  supremeRtgs?: number;
  supremeCash?: number;
}

export interface GoldRatesResponse {
  mcxLiveRate: number;
  rates: GoldRate[];
  taxSettings?: TaxSettings;
  supremeChanges?: SupremeChanges;
  /** Which vendor feed supplied the cash/RTGS bhaw for these rates. */
  bhawSource?: { key: string; name: string; live: boolean };
}

export interface UpdateGoldRatePayload {
  carat: string;
  purity: number;
  increaseByAmount?: number;
  increaseByType?: GoldIncreaseByType;
}

export interface UpdateGoldRateVisibilityPayload {
  carat?: string;
  id?: string;
  hidden: boolean;
}

export interface UpdateGoldTaxSettingsPayload {
  mcxChange?: McxChange;
  rtgsChangeBy?: number;
  cashChangeBy?: number;
  scannerCalculationUse?: 'rtgs' | 'cash';
  rtgsTaxPercent?: number;
  rtgsVariant?: 'taxed' | 'plain';
}

export interface StoneRate {
  id: string;
  color: string;
  clarity: string;
  shape?: string;
  packetCode?: string;
  rate: number;
  updatedAt?: string;
}

export interface UpsertStoneRatePayload {
  id?: string;
  color: string;
  clarity: string;
  shape?: string;
  packetCode?: string;
  rate: number;
}

export type StoneLookupType = 'diamond' | 'colorstone';

export interface StoneRateLookupPayload {
  type: StoneLookupType;
  color: string;
  clarity: string;
  shape?: string;
  packetCode?: string;
}

export interface StoneRateLookupResponse {
  rate: number;
}

export type LabourChargeType = 'AMOUNT' | 'PERCENTAGE';

export interface LabourRate {
  id?: string;
  chargeType: LabourChargeType;
  value: number;
  rupeesUnit?: 'Per Gram' | 'Per 10 Gram';
  weightBasis?: LabourWeightBasis;
  updatedAt?: string;
}

export interface UpsertLabourRatePayload {
  chargeType: LabourChargeType;
  value: number;
  rupeesUnit?: 'Per Gram' | 'Per 10 Gram';
  weightBasis?: LabourWeightBasis;
}
