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
  rtgsFinalRate?: number;
  cashFinalRate?: number;
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
  updatedAt?: string;
}

export interface UpsertLabourRatePayload {
  chargeType: LabourChargeType;
  value: number;
  rupeesUnit?: 'Per Gram' | 'Per 10 Gram';
}
