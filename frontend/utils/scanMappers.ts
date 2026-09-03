import type { JewelleryType, ScanItemData, ScanMode } from '@/types/scanner';
import type {
  ApiJewelleryType,
  ApiScanType,
  ClarificationField,
  ConfirmedMapping,
  StructuredScanData,
} from '@/types/scanner';
import { DEFAULT_LABOUR_CHARGE_UNIT, DEFAULT_LABOUR_WEIGHT_BASIS } from '@/constants/labour';
import { buildQuality } from '@/utils/qualityUtils';
import { getClarificationFieldLabel } from '@/utils/clarificationFields';
import { parseLabourFromApi, serializeLabourForApi } from '@/utils/labourUtils';
import { parseNumericValue } from '@/utils/scanPriceCalculation';
import { normalizeKarat } from '@/utils/formulaUtils';

type ApiMappedScanItemKey =
  | 'grossWt'
  | 'netWt'
  | 'pureWt'
  | 'tunch'
  | 'karat'
  | 'goldRate'
  | 'diamondWeight'
  | 'diamondColor'
  | 'diamondClarity'
  | 'diamondPieces'
  | 'diamondRate'
  | 'diamondQuality'
  | 'diamondShape'
  | 'packetCode'
  | 'colorstoneWeight'
  | 'colorstoneColor'
  | 'colorstoneClarity'
  | 'colorstoneRate'
  | 'colorstoneQuality';

const JEWELLERY_TYPE_TO_API: Record<JewelleryType, ApiJewelleryType> = {
  Diamond: 'DIAMOND',
  Gold: 'GOLD',
};

const API_FIELD_LABELS: Record<string, string> = {
  grossWeight: 'Gross Wt',
  netWeight: 'Net Wt',
  pureWeight: 'Pure Wt',
  purity: 'Purity / Tunch',
  diamondWeight: 'Diamond Wt',
  diamondPieces: 'Diamond Pieces',
  diamondRate: 'Diamond Rate',
  diamondQuality: 'Diamond Quality',
  diamondColor: 'Diamond Color',
  diamondClarity: 'Diamond Clarity',
  diamondShape: 'Diamond Shape',
  packetCode: 'Packet Code',
  goldWeight: 'Gold Wt',
  goldRate: 'Gold Rate',
  goldQuality: 'Gold Quality',
  goldPieces: 'Gold Pieces',
  colorstoneWeight: 'CS Wt',
  colorstoneRate: 'CS Rate',
  colorstoneQuality: 'CS Quality',
  colorstoneColor: 'CS Color',
  colorstoneClarity: 'CS Clarity',
  labour: 'Labour',
  otherCharges: 'Other Charges',
  otherChargesRemarks: 'Other Charges Remarks',
  other: 'Other',
};

const SCAN_ITEM_TO_API: Record<ApiMappedScanItemKey, string> = {
  grossWt: 'grossWeight',
  netWt: 'netWeight',
  pureWt: 'pureWeight',
  tunch: 'purity',
  karat: 'karat',
  goldRate: 'goldRate',
  diamondWeight: 'diamondWeight',
  diamondColor: 'diamondColor',
  diamondClarity: 'diamondClarity',
  diamondPieces: 'diamondPieces',
  diamondRate: 'diamondRate',
  diamondQuality: 'diamondQuality',
  diamondShape: 'diamondShape',
  packetCode: 'packetCode',
  colorstoneWeight: 'colorstoneWeight',
  colorstoneColor: 'colorstoneColor',
  colorstoneClarity: 'colorstoneClarity',
  colorstoneRate: 'colorstoneRate',
  colorstoneQuality: 'colorstoneQuality',
};

const API_TO_SCAN_ITEM: Record<string, ApiMappedScanItemKey> = {
  grossWeight: 'grossWt',
  netWeight: 'netWt',
  pureWeight: 'pureWt',
  purity: 'tunch',
  karat: 'karat',
  goldRate: 'goldRate',
  diamondWeight: 'diamondWeight',
  diamondColor: 'diamondColor',
  diamondClarity: 'diamondClarity',
  diamondPieces: 'diamondPieces',
  diamondRate: 'diamondRate',
  diamondQuality: 'diamondQuality',
  diamondShape: 'diamondShape',
  packetCode: 'packetCode',
  colorstoneWeight: 'colorstoneWeight',
  colorstoneColor: 'colorstoneColor',
  colorstoneClarity: 'colorstoneClarity',
  colorstoneRate: 'colorstoneRate',
  colorstoneQuality: 'colorstoneQuality',
};

export function toApiJewelleryType(type: JewelleryType): ApiJewelleryType {
  return JEWELLERY_TYPE_TO_API[type];
}

export function toApiScanType(mode: ScanMode): ApiScanType {
  return mode === 'both' ? 'BOTH_SIDES' : 'SINGLE_SIDE';
}

export function getApiFieldLabel(field: string, jewelleryType?: JewelleryType): string {
  if (jewelleryType) {
    return getClarificationFieldLabel(field, jewelleryType);
  }
  return API_FIELD_LABELS[field] ?? field;
}

/** API-mapped scan fields cleared before apply so stale demo defaults are not kept. */
export function structuredDataToScanItem(data: StructuredScanData): Partial<ScanItemData> {
  const result: Partial<ScanItemData> = {};

  for (const scanKey of Object.values(API_TO_SCAN_ITEM)) {
    result[scanKey] = '';
  }
  result.labourPurityPercent = '';
  result.labourChargeAmount = '';
  result.labourChargeUnit = DEFAULT_LABOUR_CHARGE_UNIT;
  result.labourWeightBasis = DEFAULT_LABOUR_WEIGHT_BASIS;
  result.otherChargesAmount = '';
  result.otherChargesItems = [];
  result.otherChargesRemarks = '';
  result.clubDiamonds = false;
  result.clubColorstones = false;
  result.clubbedDiamondsBackup = '';
  result.clubbedColorstonesBackup = '';
  result.customPurityPercent = '';
  result.goldRate = '';
  result.sku = '';
  result.diamondAmount = '';

  // The tag's item number (ITEM/STYLE/ST/SR NO) arrives as serialNumber.
  const serialNumber = data.serialNumber;
  if (serialNumber != null && String(serialNumber).trim() !== '') {
    result.sku = String(serialNumber).trim();
  }

  for (const [apiKey, value] of Object.entries(data)) {
    if (apiKey === 'labour') continue;
    const scanKey = API_TO_SCAN_ITEM[apiKey];
    if (scanKey && value != null && String(value).trim() !== '') {
      result[scanKey] = String(value);
    }
  }

  if (!result.karat) {
    const karatFromApi = normalizeKarat(String(data.karat ?? ''));
    const karatFromPurity = normalizeKarat(String(data.purity ?? ''));
    const resolved = karatFromApi || karatFromPurity;
    if (resolved) {
      result.karat = resolved;
    }
  }

  if (data.labour != null && String(data.labour).trim() !== '') {
    const parsed = parseLabourFromApi(String(data.labour));
    result.labourPurityPercent = parsed.labourPurityPercent;
    result.labourChargeAmount = parsed.labourChargeAmount;
    result.labourChargeUnit = parsed.labourChargeUnit;
  }

  if (data.otherCharges != null && String(data.otherCharges).trim() !== '') {
    const amount = parseNumericValue(String(data.otherCharges));
    result.otherChargesAmount = String(data.otherCharges);
    if (amount > 0) {
      result.otherChargesItems = [
        {
          id: 'legacy-other-charges',
          name: 'Other Charges',
          amount,
        },
      ];
    }
  }

  if (data.otherChargesRemarks != null && String(data.otherChargesRemarks).trim() !== '') {
    result.otherChargesRemarks = String(data.otherChargesRemarks);
  }

  if (result.diamondColor || result.diamondClarity) {
    result.diamondQuality = buildQuality(
      result.diamondColor ?? '',
      result.diamondClarity ?? '',
    );
  }

  if (result.colorstoneColor || result.colorstoneClarity) {
    result.colorstoneQuality = buildQuality(
      result.colorstoneColor ?? '',
      result.colorstoneClarity ?? '',
    );
  }

  return result;
}

export function scanItemToStructuredData(
  scanData: ScanItemData,
  existing: StructuredScanData = {},
): StructuredScanData {
  const result: StructuredScanData = { ...existing };
  if (scanData.sku?.trim()) {
    result.serialNumber = scanData.sku.trim();
  }
  for (const [scanKey, apiKey] of Object.entries(SCAN_ITEM_TO_API) as [
    ApiMappedScanItemKey,
    string,
  ][]) {
    const value = scanData[scanKey];
    if (value) {
      result[apiKey] = String(value);
    }
  }

  const labourValue = serializeLabourForApi(scanData);
  if (labourValue) {
    result.labour = labourValue;
  }

  const otherChargesTotal = scanData.otherChargesItems?.length
    ? scanData.otherChargesItems.reduce((sum, item) => sum + (item.amount || 0), 0)
    : parseNumericValue(scanData.otherChargesAmount);
  if (otherChargesTotal > 0) {
    result.otherCharges = String(otherChargesTotal);
  } else {
    delete result.otherCharges;
  }

  if (scanData.otherChargesRemarks?.trim()) {
    result.otherChargesRemarks = scanData.otherChargesRemarks.trim();
  } else {
    delete result.otherChargesRemarks;
  }

  return result;
}

export function buildConfirmedMappings(
  fields: ClarificationField[],
  selections: Record<string, { mappedField: string; description?: string }>,
): ConfirmedMapping[] {
  return fields.map((field) => ({
    abbreviation: field.abbreviation,
    mappedField: selections[field.abbreviation]?.mappedField ?? field.suggestedField,
    ...(selections[field.abbreviation]?.mappedField === 'other' &&
    selections[field.abbreviation]?.description
      ? { description: selections[field.abbreviation].description }
      : {}),
  }));
}
