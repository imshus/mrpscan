import type { BhawVendor } from '@/utils/bhawApi';

/**
 * Cash and RTGS rates for the selected bullion provider.
 *
 *   cash = MCX base + provider's cash_bhaw + the shop's own cash adjustment
 *   rtgs = MCX base + provider's rtgs_bhaw + the shop's own rtgs adjustment
 *
 * The provider's bhaw is a signed rupee figure — JMD Patil currently quotes
 * cash at a discount (−3,200) and RTGS at a premium (+4,800) — so it is always
 * added, never conditionally subtracted.
 *
 * The shop's own adjustments come from Gold Rate Settings and are kept in the
 * formula deliberately: they are what the shop sells at. Dropping them would
 * quietly reprice every scan.
 */

export interface BhawRateInputs {
  /** MCX 24K rate after the business's MCX adjustment. */
  mcxBaseRate: number;
  vendor: BhawVendor | null;
  /** Shop's own cash adjustment from Gold Rate Settings. */
  businessCashChange?: number;
  /** Shop's own RTGS adjustment from Gold Rate Settings. */
  businessRtgsChange?: number;
  /** Used when the feed is unreachable, so rates degrade instead of collapsing. */
  fallbackCashBhaw?: number;
  fallbackRtgsBhaw?: number;
}

export interface BhawRates {
  cashRate: number;
  rtgsRate: number;
  /** The bhaw actually applied, whether live or fallback. */
  cashBhaw: number;
  rtgsBhaw: number;
  /** False when the numbers came from the fallback rather than the live feed. */
  isLive: boolean;
}

export function calculateBhawRates({
  mcxBaseRate,
  vendor,
  businessCashChange = 0,
  businessRtgsChange = 0,
  fallbackCashBhaw = 0,
  fallbackRtgsBhaw = 0,
}: BhawRateInputs): BhawRates {
  const base = Number.isFinite(mcxBaseRate) ? mcxBaseRate : 0;
  const isLive = vendor !== null;

  const cashBhaw = vendor ? vendor.cashBhaw : fallbackCashBhaw;
  const rtgsBhaw = vendor ? vendor.rtgsBhaw : fallbackRtgsBhaw;

  return {
    cashRate: Math.round(base + cashBhaw + businessCashChange),
    rtgsRate: Math.round(base + rtgsBhaw + businessRtgsChange),
    cashBhaw,
    rtgsBhaw,
    isLive,
  };
}
