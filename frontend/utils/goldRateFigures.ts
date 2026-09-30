import type { GoldRatesResponse } from '@/types/rates';
import { feedMcxSell, houseMcxSell, type BhawVendor } from '@/utils/bhawApi';
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
  /**
   * The followed house's own "Gold Future MCX", straight off its Dashboard
   * Settings card — the shop follows one house, and its MCX is that
   * house's. The market majority stands in only for a house with no line.
   * Null until the boards have answered — a dash, never the server's own
   * snapshot, which is a number no bullion card shows.
   */
  mcx: number | null;
  /** The line the followed house's bhaw is quoted over, its own MCX. */
  pricingMcx: number;
  rtgsBhaw: number;
  cashBhaw: number;
  /** The house these stand on, as the server priced it. */
  houseName: string;
  /**
   * Which bhaw sides the house has published. Retail needs its cash side
   * and RTGS its RTGS side; a house may have one and not the other (Shri
   * Sai quotes RTGS and no cash), and each figure follows its own side.
   */
  cashLive: boolean;
  rtgsLive: boolean;
  /** True when at least one side is the house's own. */
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
  /** Null while the boards have not answered; the card shows a dash. */
  mcxFinal: number | null;
  /** Null when the followed house has no board Cash: no value, as for RTGS. */
  retailFinal: number | null;
  /**
   * Null when the followed house has no board RTGS: no value, at the shop's
   * asking, rather than a figure the house never published.
   */
  rtgsRate1: number | null;
  rtgsRate2: number | null;
  /** The RTGS rate ticked in Gold Rate Settings: Rate 1 or Rate 2. */
  rtgsSelected: number | null;
}

/**
 * What RTGS Rate 2's Tax box holds until the shop types otherwise: 0, at
 * the shop's asking — Rate 2 (without tax) is the board figure itself
 * unless the shop takes something off it.
 */
export const RTGS_RATE2_DEFAULT_TAX_PERCENT = 0;

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
  // Each bhaw side stands on its own: a house that quotes RTGS but not cash
  // (Shri Sai today) prices RTGS off its own board and shows no Retail. The
  // house's own MCX line is used whenever it has one; the server's base
  // stands in only while the phone has not heard from the boards.
  const cashLive = vendor?.cashBhaw != null;
  const rtgsLive = vendor?.rtgsBhaw != null;
  // Rounded as the server rounds the line it prices on.
  const houseLine = houseMcxSell(vendor);
  return {
    mcx: houseLine !== null ? Math.round(houseLine) : feedMcxSell(vendors),
    pricingMcx:
      houseLine !== null ? Math.round(houseLine) : gold.taxSettings?.pricingMcxLiveRate ?? gold.mcxLiveRate,
    rtgsBhaw: rtgsLive && vendor ? (vendor.rtgsBhaw as number) : gold.supremeChanges?.rtgsChange ?? 0,
    cashBhaw: cashLive && vendor ? (vendor.cashBhaw as number) : gold.supremeChanges?.cashChange ?? 0,
    houseName: vendor?.name || houseNameFor(serverKey ?? '', gold.bhawSource?.name),
    cashLive,
    rtgsLive,
    houseLive: cashLive || rtgsLive,
  };
}

export function goldRateChanges(gold: GoldRatesResponse): GoldRateChanges {
  const t = gold.taxSettings;
  return {
    mcxChange: t?.mcxChangeBy ?? resolveMcxChangeValue(t?.mcxChange),
    rtgsChange: t?.rtgsChangeBy ?? 0,
    cashChange: t?.cashChangeBy ?? 0,
    // The Tax box's percent. A saved number is what the shop chose; a
    // field never saved reads as the default 0, the board figure itself.
    // The server's rule.
    rtgsTaxPercent: t?.rtgsTaxPercent ?? RTGS_RATE2_DEFAULT_TAX_PERCENT,
    // RTGS Rate 1 is ticked unless the shop ticked Rate 2. The server's rule.
    rtgsVariant: t?.rtgsVariant === 'plain' ? 'plain' : 'taxed',
  };
}

/**
 * The server's composition, expression for expression and rounding for
 * rounding (rateCalculation.service.js: mcxFinalRate, cashFinalRate,
 * rtgsRate1FinalRate, rtgsRate2FinalRate, rtgsFinalRate).
 */
/**
 * RTGS Rate 2 is the house's Gold Future MCX divided by this: the MCX figure
 * with its 3% taken out, at the shop's asking. The server divides by the same.
 */
export const RTGS_RATE2_MCX_DIVISOR = 1.03;

export function computeGoldRateFigures(base: GoldRateBase, changes: GoldRateChanges): GoldRateFigures {
  const mcxFinal = base.mcx === null ? null : base.mcx + changes.mcxChange;
  const pricing = base.pricingMcx + changes.mcxChange;
  // Retail and RTGS each need the house's own board side; a house that has
  // not published it gives no value, at the shop's asking.
  const retailFinal = base.cashLive ? pricing + base.cashBhaw + changes.cashChange : null;
  // RTGS Rate 1 is the house's board RTGS (its line + its bhaw) straight
  // off the Dashboard Settings card, plus the shop's change, with no tax on
  // it; null when the house has no board RTGS. Rate 2 (without tax) is the
  // house's Gold Future MCX as fetched (before the shop's MCX change)
  // divided by 1.03, less the percent in its Tax box. The server's
  // expression and rounding.
  const rtgsBoard = base.rtgsLive ? pricing + base.rtgsBhaw + changes.rtgsChange : null;
  const rtgsRate1 = rtgsBoard === null ? null : Math.round(rtgsBoard);
  const rtgsRate2 = Math.round(
    (base.pricingMcx / RTGS_RATE2_MCX_DIVISOR) * (1 - changes.rtgsTaxPercent / 100),
  );
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
