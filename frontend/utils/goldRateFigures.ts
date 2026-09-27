import type { GoldRatesResponse } from '@/types/rates';
import { feedMcxSell, hasLiveBhaw, houseMcxSell, type BhawVendor } from '@/utils/bhawApi';
import { resolveMcxChangeValue } from '@/utils/goldRateUtils';

/**
 * The one calculation behind every gold figure the app shows.
 *
 * Gold Rate Settings is where the shop sets its changes, and Home shows the
 * figures Gold Rate Settings arrives at — the same inputs through the same
 * arithmetic, at the shop's asking, after the two screens read different
 * things and disagreed by the shop's own MCX change. The arithmetic is the
 * server's (rateCalculation.service.js), which is what scans are priced
 * on, so all three agree.
 */

/** What the figures stand on: the market MCX, the house line, the bhaw. */
export interface GoldRateBase {
  /** The market MCX: the figure most houses agree on, off the live boards. */
  mcx: number;
  /** The line the followed house's bhaw is quoted over, its own MCX. */
  pricingMcx: number;
  rtgsBhaw: number;
  cashBhaw: number;
  /** The house these stand on, as the server priced it. */
  houseName: string;
  /** True when the house's own bhaw is in these, false on the fallback. */
  houseLive: boolean;
}

/** The shop's own adjustments, as saved in Gold Rate Settings. */
export interface GoldRateChanges {
  mcxChange: number;
  rtgsChange: number;
  cashChange: number;
  rtgsTaxPercent: number;
  rtgsVariant: 'taxed' | 'plain';
}

export interface GoldRateFigures {
  mcxFinal: number;
  retailFinal: number;
  rtgsRate1: number;
  rtgsRate2: number;
  /** The RTGS rate ticked in Gold Rate Settings: Rate 1 or Rate 2. */
  rtgsSelected: number;
}

const HOUSE_NAMES: Record<string, string> = {
  jmd_patil: 'JMD Patil',
  mega_bullion: 'Mega Bullion',
  shri_sai: 'Shri Sai Jewels',
  shri_ganesh: 'Shri Ganesh Bullion',
};

export function houseNameFor(key: string, fallback?: string): string {
  return HOUSE_NAMES[key] ?? fallback ?? key;
}

/**
 * The base off the server's response and the live boards. The house is the
 * one the server priced on (bhawSource), so what the screens show is what
 * scans charge, whichever house this phone last tapped; the phone's own
 * choice stands in only until the server has answered.
 */
export function goldRateBase(
  gold: GoldRatesResponse,
  vendors: BhawVendor[],
  phoneVendor: BhawVendor | null,
): GoldRateBase {
  const serverKey = gold.bhawSource?.key;
  const vendor = (serverKey ? vendors.find((v) => v.source === serverKey) : null) ?? phoneVendor;
  // The server's rule: a house's bhaw counts only when both sides are
  // published; a house that has published one side, or none, is priced on
  // the stored change over the market MCX.
  const live = hasLiveBhaw(vendor);
  const houseLine = live ? houseMcxSell(vendor) : null;
  const mcx = feedMcxSell(vendors) ?? gold.mcxLiveRate;
  return {
    mcx,
    // Rounded as the server rounds the line it prices on.
    pricingMcx:
      houseLine !== null ? Math.round(houseLine) : gold.taxSettings?.pricingMcxLiveRate ?? gold.mcxLiveRate,
    rtgsBhaw: live && vendor?.rtgsBhaw != null ? vendor.rtgsBhaw : gold.supremeChanges?.rtgsChange ?? 0,
    cashBhaw: live && vendor?.cashBhaw != null ? vendor.cashBhaw : gold.supremeChanges?.cashChange ?? 0,
    houseName: vendor?.name ?? houseNameFor(serverKey ?? '', gold.bhawSource?.name),
    houseLive: live,
  };
}

export function goldRateChanges(gold: GoldRatesResponse): GoldRateChanges {
  const t = gold.taxSettings;
  return {
    mcxChange: t?.mcxChangeBy ?? resolveMcxChangeValue(t?.mcxChange),
    rtgsChange: t?.rtgsChangeBy ?? 0,
    cashChange: t?.cashChangeBy ?? 0,
    rtgsTaxPercent: t?.rtgsTaxPercent ?? 0,
    rtgsVariant: t?.rtgsVariant === 'taxed' ? 'taxed' : 'plain',
  };
}

/**
 * The server's composition, expression for expression and rounding for
 * rounding (rateCalculation.service.js: mcxFinalRate, cashFinalRate,
 * rtgsRate1FinalRate, rtgsRate2FinalRate, rtgsFinalRate).
 */
export function computeGoldRateFigures(base: GoldRateBase, changes: GoldRateChanges): GoldRateFigures {
  const mcxFinal = base.mcx + changes.mcxChange;
  const pricing = base.pricingMcx + changes.mcxChange;
  const retailFinal = pricing + base.cashBhaw + changes.cashChange;
  const rtgsRate1 = pricing + base.rtgsBhaw + changes.rtgsChange;
  const rtgsRate2 = Math.round(rtgsRate1 * (1 - changes.rtgsTaxPercent / 100));
  return {
    mcxFinal,
    retailFinal,
    rtgsRate1,
    rtgsRate2,
    rtgsSelected: changes.rtgsVariant === 'taxed' ? rtgsRate1 : rtgsRate2,
  };
}

/** A karat's share of a 24K figure, rounded as the server rounds its rows. */
export function karatFigure(figure: number, purity: number): number {
  return Math.round(figure * (purity / 100));
}
