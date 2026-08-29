import type {
  GoldRate,
  GoldRatesResponse,
  LabourRate,
  McxChange,
  StoneRate,
  StoneRateLookupPayload,
  StoneRateLookupResponse,
  UpdateGoldRatePayload,
  UpdateGoldRateVisibilityPayload,
  UpdateGoldTaxSettingsPayload,
  TaxSettings,
  SupremeChanges,
  UpsertLabourRatePayload,
  UpsertStoneRatePayload,
} from '@/types/rates';
import { apiRequest, ApiError } from '@/utils/apiClient';
import { unwrapApiData } from '@/utils/apiResponse';

type ApiEnvelope = Record<string, unknown> & {
  success?: boolean;
  data?: unknown;
};

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value != null && typeof value === 'object' && 'toString' in value) {
    const asString = String(value);
    if (asString.trim() && asString !== '[object Object]') return asString.trim();
  }
  return undefined;
}

function normalizeMcxChange(raw: Record<string, unknown> | undefined): McxChange | undefined {
  if (!raw) return undefined;
  const operation = readString(raw.operation);
  const amount = readNumber(raw.amount);
  if (!operation || amount == null) return undefined;
  return { operation: operation === '-' ? '-' : '+', amount };
}

function normalizeGoldRate(raw: Record<string, unknown>): GoldRate | null {
  const carat = readString(raw.carat ?? raw.karat);
  const purity = readNumber(raw.purity);
  const finalRate = readNumber(
    raw.finalRate ??
      raw.final_rate ??
      raw.calculatedFinalRate ??
      raw.calculated_final_rate ??
      raw.rate,
  );

  if (!carat || purity == null || finalRate == null) {
    return null;
  }

  const increaseByType = readString(raw.increaseByType ?? raw.increase_by_type);
  const normalizedIncreaseByType =
    increaseByType === 'PERCENTAGE' || increaseByType === 'FLAT' ? increaseByType : undefined;

  return {
    id: readString(raw.id ?? raw._id),
    carat,
    purity,
    finalRate,
    baseRate: readNumber(raw.baseRate ?? raw.base_rate),
    increaseByAmount: readNumber(raw.increaseByAmount ?? raw.increase_by_amount),
    increaseByType: normalizedIncreaseByType,
    isHidden:
      typeof raw.isHidden === 'boolean'
        ? raw.isHidden
        : typeof raw.is_hidden === 'boolean'
          ? raw.is_hidden
          : typeof raw.hidden === 'boolean'
            ? raw.hidden
            : undefined,
    mcxRate: readNumber(raw.mcxRate),
    cashRate: readNumber(raw.cashRate),
    rtgsRate: readNumber(raw.rtgsRate),
  };
}

function normalizeStoneRate(raw: Record<string, unknown>): StoneRate | null {
  const color = readString(raw.color) ?? '';
  const clarity = readString(raw.clarity) ?? '';
  const packetCode = readString(raw.packetCode ?? raw.packet_code) ?? '';
  const shape = (() => {
    const rawShape = raw.shape;
    if (rawShape == null) return '';
    if (typeof rawShape === 'number') {
      return rawShape === 0 ? '' : String(rawShape);
    }
    if (typeof rawShape === 'string') return rawShape.trim();
    if (typeof rawShape === 'object' && 'value' in rawShape) {
      const value = (rawShape as { value?: string | number | null }).value;
      if (value == null) return '';
      if (typeof value === 'number') return value === 0 ? '' : String(value);
      if (typeof value === 'string') return value.trim();
    }
    return '';
  })();
  const rate = readNumber(raw.rate);

  if (rate == null || (!color && !clarity && !shape && !packetCode)) {
    return null;
  }

  const id =
    readString(raw.id ?? raw._id) ??
    `${packetCode.trim().toLowerCase()}|${color.trim().toLowerCase()}|${clarity
      .trim()
      .toLowerCase()}|${shape.trim().toLowerCase()}|${rate}`;

  return {
    id,
    color,
    clarity,
    shape,
    packetCode,
    rate,
    updatedAt: readString(raw.updatedAt ?? raw.updated_at),
  };
}

function normalizeRateList(raw: unknown): StoneRate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(normalizeStoneRate)
    .filter((item): item is StoneRate => item !== null);
}

function extractRatesArray(payload: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function normalizeGoldRatesResponse(response: unknown): GoldRatesResponse {
  const unwrapped = unwrapApiData((response ?? {}) as ApiEnvelope);
  const mcxLiveRate =
    readNumber(unwrapped.mcxLiveRate ?? unwrapped.mcx_live_rate) ?? 0;
  const ratesRaw = extractRatesArray(unwrapped, ['rates', 'goldRates', 'items', 'data']);
  const rates = (Array.isArray(ratesRaw) ? ratesRaw : [])
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(normalizeGoldRate)
    .filter((item): item is GoldRate => item !== null);

  const rawTax = unwrapped.taxSettings as Record<string, unknown> | undefined;
  let taxSettings: TaxSettings | undefined;
  if (rawTax) {
    const rawMcxChange = rawTax.mcxChange as Record<string, unknown> | undefined;
    const mcxChangeBy = readNumber(rawTax.mcxChangeBy ?? rawTax.mcx_change_by);
    const mcxFinalRate = readNumber(rawTax.mcxFinalRate ?? rawTax.mcx_final_rate);
    taxSettings = {
      mcxChange: normalizeMcxChange(rawMcxChange),
      mcxChangeBy,
      mcxFinalRate,
      rtgsChangeBy: readNumber(rawTax.rtgsChangeBy ?? rawTax.rtgs_change_by) ?? 0,
      cashChangeBy: readNumber(rawTax.cashChangeBy ?? rawTax.cash_change_by) ?? 0,
      scannerCalculationUse: (readString(rawTax.scannerCalculationUse) || 'rtgs') as 'rtgs' | 'cash',
      rtgsFinalRate: readNumber(rawTax.rtgsFinalRate ?? rawTax.rtgs_final_rate),
      cashFinalRate: readNumber(rawTax.cashFinalRate ?? rawTax.cash_final_rate),
    };
  }

  const rawSupreme = unwrapped.supremeChanges as Record<string, unknown> | undefined;
  let supremeChanges: SupremeChanges | undefined;
  if (rawSupreme) {
    supremeChanges = {
      rtgsChange: readNumber(rawSupreme.rtgsChange ?? rawSupreme.rtgs_change) ?? 0,
      cashChange: readNumber(rawSupreme.cashChange ?? rawSupreme.cash_change) ?? 0,
      supremeRtgs: readNumber(rawSupreme.supremeRtgs ?? rawSupreme.supreme_rtgs),
      supremeCash: readNumber(rawSupreme.supremeCash ?? rawSupreme.supreme_cash),
    };
  }

  return { mcxLiveRate, rates, taxSettings, supremeChanges };
}

export function normalizeStoneRatesResponse(response: unknown): StoneRate[] {
  const unwrapped = unwrapApiData((response ?? {}) as ApiEnvelope);
  const list = extractRatesArray(unwrapped, ['rates', 'diamondRates', 'colorstoneRates', 'items', 'data']);
  if (Array.isArray(list) && list.length > 0) {
    return normalizeRateList(list);
  }
  if (Array.isArray(unwrapped)) {
    return normalizeRateList(unwrapped);
  }
  return normalizeRateList(unwrapped.data);
}

export async function fetchGoldRates(): Promise<GoldRatesResponse> {
  const response = await apiRequest<ApiEnvelope>('/rates/gold', { method: 'GET' });
  return normalizeGoldRatesResponse(response);
}

export async function updateGoldRate(payload: UpdateGoldRatePayload): Promise<GoldRate> {
  const response = await apiRequest<ApiEnvelope>('/rates/gold', {
    method: 'POST',
    body: payload as unknown as Record<string, unknown>,
  });
  const unwrapped = unwrapApiData(response);
  const normalized = normalizeGoldRate(unwrapped);
  if (normalized) return normalized;

  const nested = unwrapped.rate ?? unwrapped.data;
  if (nested && typeof nested === 'object') {
    const fromNested = normalizeGoldRate(nested as Record<string, unknown>);
    if (fromNested) return fromNested;
  }

  throw new Error('Invalid gold rate update response from server');
}

export async function updateGoldRateVisibility(
  payload: UpdateGoldRateVisibilityPayload,
): Promise<GoldRate> {
  const response = await apiRequest<ApiEnvelope>('/rates/gold/visibility', {
    method: 'PATCH',
    body: payload as unknown as Record<string, unknown>,
  });
  const unwrapped = unwrapApiData(response);
  const normalized = normalizeGoldRate(unwrapped);
  if (normalized) return normalized;

  const nested = (unwrapped as Record<string, unknown>).rate ??
    (unwrapped as Record<string, unknown>).data;
  if (nested && typeof nested === 'object') {
    const fromNested = normalizeGoldRate(nested as Record<string, unknown>);
    if (fromNested) return fromNested;
  }

  throw new Error('Invalid gold rate visibility response from server');
}

export async function updateGoldTaxSettings(payload: UpdateGoldTaxSettingsPayload): Promise<TaxSettings> {
  const response = await apiRequest<ApiEnvelope>('/rates/gold/tax-settings', {
    method: 'POST',
    body: payload as unknown as Record<string, unknown>,
  });
  
  const unwrapped = unwrapApiData(response) as Record<string, unknown>;
  const rawTax = unwrapped.taxSettings ?? unwrapped;
  
  if (rawTax && typeof rawTax === 'object') {
    const rawMcxChange = (rawTax as Record<string, unknown>).mcxChange as Record<string, unknown> | undefined;
    const mcxChangeBy = readNumber((rawTax as Record<string, unknown>).mcxChangeBy ?? (rawTax as Record<string, unknown>).mcx_change_by);
    const mcxFinalRate = readNumber((rawTax as Record<string, unknown>).mcxFinalRate ?? (rawTax as Record<string, unknown>).mcx_final_rate);
    return {
      mcxChange: normalizeMcxChange(rawMcxChange),
      mcxChangeBy,
      mcxFinalRate,
      rtgsChangeBy: readNumber((rawTax as Record<string, unknown>).rtgsChangeBy) ?? 0,
      cashChangeBy: readNumber((rawTax as Record<string, unknown>).cashChangeBy) ?? 0,
      scannerCalculationUse: (readString((rawTax as Record<string, unknown>).scannerCalculationUse) || 'rtgs') as 'rtgs' | 'cash',
    };
  }
  throw new Error('Invalid tax settings response from server');
}

export async function fetchDiamondRates(): Promise<StoneRate[]> {
  const response = await apiRequest<ApiEnvelope>('/rates/diamond', { method: 'GET' });
  return normalizeStoneRatesResponse(response);
}

export async function upsertDiamondRate(payload: UpsertStoneRatePayload): Promise<StoneRate> {
  const response = await apiRequest<ApiEnvelope>('/rates/diamond', {
    method: 'POST',
    body: payload as unknown as Record<string, unknown>,
  });
  const unwrapped = unwrapApiData(response);
  const normalized = normalizeStoneRate(unwrapped);
  if (normalized) return normalized;

  const nested = unwrapped.rate ?? unwrapped.data;
  if (nested && typeof nested === 'object') {
    const fromNested = normalizeStoneRate(nested as Record<string, unknown>);
    if (fromNested) return fromNested;
  }

  throw new Error('Invalid diamond rate response from server');
}

export async function fetchColorstoneRates(): Promise<StoneRate[]> {
  const response = await apiRequest<ApiEnvelope>('/rates/colorstone', { method: 'GET' });
  return normalizeStoneRatesResponse(response);
}

export async function upsertColorstoneRate(payload: UpsertStoneRatePayload): Promise<StoneRate> {
  const response = await apiRequest<ApiEnvelope>('/rates/colorstone', {
    method: 'POST',
    body: payload as unknown as Record<string, unknown>,
  });
  const unwrapped = unwrapApiData(response);
  const normalized = normalizeStoneRate(unwrapped);
  if (normalized) return normalized;

  const nested = unwrapped.rate ?? unwrapped.data;
  if (nested && typeof nested === 'object') {
    const fromNested = normalizeStoneRate(nested as Record<string, unknown>);
    if (fromNested) return fromNested;
  }

  throw new Error('Invalid colorstone rate response from server');
}

export async function deleteDiamondRate(id: string): Promise<void> {
  await apiRequest<ApiEnvelope>(`/rates/diamond/${id}`, { method: 'DELETE' });
}

export async function deleteColorstoneRate(id: string): Promise<void> {
  await apiRequest<ApiEnvelope>(`/rates/colorstone/${id}`, { method: 'DELETE' });
}

export class RateNotFoundError extends Error {
  readonly quality: string;

  constructor(quality: string) {
    super(`No rate exists for quality "${quality}"`);
    this.name = 'RateNotFoundError';
    this.quality = quality;
  }
}

export async function lookupStoneRate(
  payload: StoneRateLookupPayload,
): Promise<StoneRateLookupResponse> {
  const trimmedColor = payload.color.trim();
  const trimmedClarity = payload.clarity.trim();
  const trimmedShape = payload.shape?.trim();
  const trimmedPacketCode = payload.packetCode?.trim() ?? '';
  const quality = `${trimmedColor} ${trimmedClarity}`.trim();

  if (payload.type === 'diamond') {
    try {
      const response = await apiRequest<ApiEnvelope>('/rates/diamond/lookup', {
        method: 'POST',
        body: {
          color: trimmedColor,
          clarity: trimmedClarity,
          shape: trimmedShape,
          packetCode: trimmedPacketCode,
        },
      });
      const unwrapped = unwrapApiData(response);
      const unwrappedRecord = unwrapped as Record<string, unknown>;
      const nestedData = unwrappedRecord.data;
      const nestedRate =
        nestedData && typeof nestedData === 'object'
          ? (nestedData as Record<string, unknown>).rate
          : undefined;
      const rate = readNumber(
        unwrappedRecord.rate ?? nestedRate,
      );
      if (rate == null) {
        throw new Error('Invalid diamond rate lookup response');
      }
      return { rate };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new RateNotFoundError(quality);
      }
      throw error;
    }
  }

  let rates: StoneRate[] = [];
  try {
    rates = await fetchColorstoneRates();
  } catch (error) {
    console.warn(`Failed to fetch ${payload.type} rates from API:`, error);
    // Proceed with empty rates so we can still check for local fallbacks
  }

  const match = rates.find((item) => {
    const colorMatch = item.color.trim().toLowerCase() === trimmedColor.toLowerCase();
    const clarityMatch = item.clarity.trim().toLowerCase() === trimmedClarity.toLowerCase();
    return colorMatch && clarityMatch;
  });

  if (match) {
    return { rate: match.rate };
  }

  throw new RateNotFoundError(quality);
}

function normalizeLabourRate(raw: Record<string, unknown>): LabourRate | null {
  const chargeType = readString(raw.chargeType ?? raw.charge_type);
  const value = readNumber(raw.value);

  if ((chargeType !== 'AMOUNT' && chargeType !== 'PERCENTAGE') || value == null) {
    return null;
  }

  return {
    id: readString(raw.id ?? raw._id),
    chargeType,
    value,
    rupeesUnit: (readString(raw.rupeesUnit) as 'Per Gram' | 'Per 10 Gram') || undefined,
    updatedAt: readString(raw.updatedAt ?? raw.updated_at),
  };
}

export async function fetchLabourRate(): Promise<LabourRate | null> {
  const response = await apiRequest<ApiEnvelope>('/rates/labour', { method: 'GET' });

  if (response.data === null || response.data === undefined) {
    return null;
  }

  const unwrapped = unwrapApiData(response);
  if (!unwrapped || typeof unwrapped !== 'object') {
    return null;
  }

  return normalizeLabourRate(unwrapped as Record<string, unknown>);
}

export async function upsertLabourRate(payload: UpsertLabourRatePayload): Promise<LabourRate> {
  const response = await apiRequest<ApiEnvelope>('/rates/labour', {
    method: 'POST',
    body: payload as unknown as Record<string, unknown>,
  });

  const unwrapped = unwrapApiData(response);
  const normalized = normalizeLabourRate(unwrapped);
  if (normalized) return normalized;

  const nested = unwrapped.rate ?? unwrapped.data;
  if (nested && typeof nested === 'object') {
    const fromNested = normalizeLabourRate(nested as Record<string, unknown>);
    if (fromNested) return fromNested;
  }

  throw new Error('Invalid labour rate response from server');
}
