import type {
  CalculateMrpPayload,
  CalculateMrpResponse,
  JewelleryType,
  ScanItemData,
  StoneEntry,
  StructuredScanData,
} from '@/types/scanner';
import { resolveScannedKarat } from '@/utils/formulaUtils';
import { calculateScanMrp } from '@/utils/scanApi';
import { computeOtherChargesTotal, parseNumericValue } from '@/utils/scanPriceCalculation';
import { parseStoneArraysFromStructuredData } from '@/utils/stoneSequenceUtils';
import { registerScopeResetCallback } from '@/utils/userScopedStorage';

export interface PricingInput {
  payload: CalculateMrpPayload;
  diamonds: StoneEntry[];
  colorstones: StoneEntry[];
  resolvedKarat: string;
}

/**
 * The one place the MRP request payload is derived from the scan state. The
 * pricing hook builds its requests through this, and the processing screen
 * uses the same derivation to start the first request early — identical
 * inputs must yield an identical payload or the prefetch cannot be matched
 * to the hook's first request.
 */
export function derivePricingInput(
  selectedType: JewelleryType,
  scanData: ScanItemData,
  structuredData: StructuredScanData | undefined,
  selectedKarat?: string,
): PricingInput {
  const resolvedKarat = selectedKarat || resolveScannedKarat(scanData.karat, scanData.tunch) || '14K';
  const { diamonds, colorstones } = parseStoneArraysFromStructuredData(structuredData ?? {}, scanData);
  const otherChargesTotal = computeOtherChargesTotal(scanData);
  const rawCustomPurity = scanData.customPurityPercent?.trim();
  const payload: CalculateMrpPayload = {
    jewelleryType: selectedType,
    netWt: parseNumericValue(scanData.netWt) || 0,
    grossWt: parseNumericValue(scanData.grossWt) || 0,
    purityKarat: resolvedKarat,
    labourChargeAmount: scanData.labourChargeAmount,
    labourChargeUnit: scanData.labourChargeUnit,
    labourWeightBasis: scanData.labourWeightBasis,
    calculationMode: scanData.calculationRate,
    otherCharges: otherChargesTotal,
    diamonds: diamonds.map((d) => ({
      weight: parseNumericValue(d.weight) || 0,
      rate: parseNumericValue(d.rate) || 0,
      discountPercent: parseNumericValue(d.discountPercent ?? '0') || 0,
    })),
    colorstones: colorstones.map((c) => ({
      weight: parseNumericValue(c.weight) || 0,
      rate: parseNumericValue(c.rate) || 0,
    })),
  };

  if (rawCustomPurity) {
    payload.customPurityPercent = parseNumericValue(rawCustomPurity);
  }

  return { diamonds, colorstones, payload, resolvedKarat };
}

interface PrefetchEntry {
  payloadKey: string;
  promise: Promise<CalculateMrpResponse>;
}

/** One in-flight first calculation per scan; old scans fall off the end. */
const prefetched = new Map<string, PrefetchEntry>();
const MAX_ENTRIES = 3;

function payloadKeyFor(payload: CalculateMrpPayload): string {
  return JSON.stringify(payload);
}

/**
 * Starts the first MRP calculation for a scan while its counter is still
 * running, so the price is already in hand when the review card opens. A
 * failed prefetch removes itself; the hook then requests normally.
 */
export function prefetchFirstPricing(scanId: string, input: PricingInput): void {
  const payloadKey = payloadKeyFor(input.payload);
  if (prefetched.get(scanId)?.payloadKey === payloadKey) return;

  const promise = calculateScanMrp(scanId, input.payload);
  prefetched.set(scanId, { payloadKey, promise });
  promise.catch(() => {
    if (prefetched.get(scanId)?.promise === promise) prefetched.delete(scanId);
  });

  while (prefetched.size > MAX_ENTRIES) {
    const oldest = prefetched.keys().next().value;
    if (oldest == null) break;
    prefetched.delete(oldest);
  }
}

/**
 * The price the server computed inside the analysis itself. The hook shows
 * it the instant the card opens — no round trip at all — and then confirms
 * with its own request, which replaces it only if the figures differ.
 */
const serverPricing = new Map<string, CalculateMrpResponse>();

// A priced scan leaves with the account that made it, like the rest of the
// scan session — even one only reachable by a scan id nobody else will hold.
registerScopeResetCallback(() => {
  prefetched.clear();
  serverPricing.clear();
});

export function seedServerPricing(scanId: string, pricing: CalculateMrpResponse): void {
  serverPricing.set(scanId, pricing);
  while (serverPricing.size > MAX_ENTRIES) {
    const oldest = serverPricing.keys().next().value;
    if (oldest == null) break;
    serverPricing.delete(oldest);
  }
}

export function takeServerPricing(scanId: string): CalculateMrpResponse | null {
  const pricing = serverPricing.get(scanId) ?? null;
  serverPricing.delete(scanId);
  return pricing;
}

/**
 * Resolves once a price for this scan is in hand — the server's from the
 * analysis, or the prefetched first calculation once it settles — so the
 * counter can hold its hand-off until the card has something to show.
 * Never rejects: a failed prefetch simply means the card prices itself.
 */
export async function awaitPricingReady(scanId: string): Promise<void> {
  if (serverPricing.has(scanId)) return;
  const entry = prefetched.get(scanId);
  if (!entry) return;
  await entry.promise.then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Hands the prefetched first calculation to the pricing hook — only when the
 * payload the hook derived matches the one the prefetch was made with, so an
 * edit made in between always prices fresh.
 */
export function takePrefetchedPricing(
  scanId: string,
  payload: CalculateMrpPayload,
): Promise<CalculateMrpResponse> | null {
  const entry = prefetched.get(scanId);
  if (!entry || entry.payloadKey !== payloadKeyFor(payload)) return null;
  prefetched.delete(scanId);
  return entry.promise;
}
