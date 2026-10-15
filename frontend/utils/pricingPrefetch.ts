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
import { useScannerStore } from '@/store/scannerStore';

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
  // The first number in each field, never below zero: weights, rates and
  // percents are not negative, and the card's own figures read them the
  // same way (a stray minus used to be dropped and flip the sign).
  const figure = (raw: string | undefined | null) => Math.max(0, parseNumericValue(raw));
  const payload: CalculateMrpPayload = {
    jewelleryType: selectedType,
    netWt: figure(scanData.netWt),
    grossWt: figure(scanData.grossWt),
    purityKarat: resolvedKarat,
    labourChargeAmount: scanData.labourChargeAmount,
    labourChargeUnit: scanData.labourChargeUnit,
    labourWeightBasis: scanData.labourWeightBasis,
    calculationMode: scanData.calculationRate,
    otherCharges: otherChargesTotal,
    // The wastage the shop charges is kept against the item code, so the
    // server needs to know which item this is before it can price it.
    itemCode: scanData.itemCode || scanData.sku || undefined,
    // Every identifier on the tag, so a Masters -> Wastage code printed
    // beside the item number is found as well.
    tagIdentifiers: useScannerStore.getState().tagIdentifiers,
    // Sent only when typed: an empty box means "the item's own figure", and
    // sending 0 instead would wipe wastage off the price.
    ...(scanData.wastagePercent?.trim()
      ? { wastagePercent: figure(scanData.wastagePercent) }
      : {}),
    diamonds: diamonds.map((d) => ({
      weight: figure(d.weight),
      rate: figure(d.rate),
      discountPercent: figure(d.discountPercent ?? '0'),
    })),
    colorstones: colorstones.map((c) => ({
      weight: figure(c.weight),
      rate: figure(c.rate),
    })),
  };

  if (rawCustomPurity) {
    payload.customPurityPercent = figure(rawCustomPurity);
  }

  return { diamonds, colorstones, payload, resolvedKarat };
}

interface PrefetchEntry {
  payloadKey: string;
  promise: Promise<CalculateMrpResponse>;
  /** The answer, once it has landed — read synchronously by the card. */
  settled?: CalculateMrpResponse;
}

/** A prefetched first calculation handed to the pricing hook. */
export interface PrefetchedPricing {
  promise: Promise<CalculateMrpResponse>;
  /** Already answered: the card shows it at once, with nothing before it. */
  settled?: CalculateMrpResponse;
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
  const entry: PrefetchEntry = { payloadKey, promise };
  prefetched.set(scanId, entry);
  promise.then(
    (response) => {
      entry.settled = response;
    },
    () => {
      if (prefetched.get(scanId)?.promise === promise) prefetched.delete(scanId);
    },
  );

  while (prefetched.size > MAX_ENTRIES) {
    const oldest = prefetched.keys().next().value;
    if (oldest == null) break;
    prefetched.delete(oldest);
  }
}

/**
 * The price the server computed inside the analysis itself. The card shows
 * it only while its own first price is still out (a slow or failed prefetch,
 * or an edit before it landed); its own request replaces it.
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
 * Resolves once the card's own first price for this scan is in hand — the
 * prefetched first calculation, made from exactly the inputs the card sends —
 * so the counter can hold its hand-off until the card has it to show. The
 * price the server made inside the analysis is derived from the reading on
 * the server's side and can differ from the card's (labour weight basis,
 * tag labour, other charges, item code), so it no longer ends the wait; it
 * is the fallback the card shows while its own price is still out.
 * Never rejects: a failed prefetch simply means the card prices itself.
 */
export async function awaitPricingReady(scanId: string): Promise<void> {
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
): PrefetchedPricing | null {
  const entry = prefetched.get(scanId);
  if (!entry || entry.payloadKey !== payloadKeyFor(payload)) return null;
  prefetched.delete(scanId);
  return { promise: entry.promise, settled: entry.settled };
}
