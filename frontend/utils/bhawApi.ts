import { readBhawSnapshot, type BhawSnapshotEntry, type BhawVendor } from './bhawPayload';
import { openEventStream } from './sseClient';

export {
  createLastGoodKeeper,
  normalizeVendor,
  parseBhawPayload,
  readBhawSnapshot,
} from './bhawPayload';
export type { BhawRow, BhawSnapshotEntry, BhawVendor } from './bhawPayload';

/**
 * Live bhaw feed — the premium/discount each bullion house quotes over MCX.
 *
 * A Server-Sent Events stream (~5 snapshots a second), each snapshot an
 * ARRAY containing EVERY provider — the shape is in utils/bhawPayload.ts.
 * Home, Gold Rate Settings and Dashboard Settings show it; the connection
 * itself is held by store/bhawStore.ts. Scans and invoices are priced by
 * the server on its own 3-minute snapshot, not on this. EXPO_PUBLIC_*
 * values are inlined at bundle time, so a changed URL needs a rebuild.
 */
export const BHAW_LIVE_STREAM_URL =
  process.env.EXPO_PUBLIC_MCX_LIVE_STEAMING || 'https://jmd.mrpscan.com/api/stream';

const BHAW_TIMEOUT_MS = 8_000;

export const BHAW_PROVIDERS = {
  JMD_PATIL: 'jmd_patil',
  MEGA_BULLION: 'mega_bullion',
  SHRI_SAI: 'shri_sai',
  SHRI_GANESH: 'shri_ganesh',
} as const;

export type BhawProvider = (typeof BHAW_PROVIDERS)[keyof typeof BHAW_PROVIDERS];

/** True when this house has published both sides and can price a scan. */
export function hasLiveBhaw(vendor: BhawVendor | null): boolean {
  return vendor !== null && vendor.cashBhaw !== null && vendor.rtgsBhaw !== null;
}

/**
 * One look at the live stream: opens it, resolves with the first snapshot
 * that carries a house it could read, and closes it. Houses the feed could
 * not read that round are in it with a null vendor (see readBhawSnapshot).
 * Rejects when the stream fails or nothing usable arrives within 8 s.
 */
export function fetchBhawSnapshot(): Promise<BhawSnapshotEntry[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let close: (() => void) | null = null;
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      close?.();
      settle();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error('Live rates stream timed out'))),
      BHAW_TIMEOUT_MS,
    );
    close = openEventStream(BHAW_LIVE_STREAM_URL, {
      onMessage: (data) => {
        const entries = readBhawSnapshot(data);
        if (entries && entries.some((entry) => entry.vendor !== null)) {
          finish(() => resolve(entries));
        }
      },
      onError: (error) => finish(() => reject(error)),
    });
    if (settled) close();
  });
}

/** The same one look, as the houses read that round (failed ones left out). */
export async function fetchBhawVendors(): Promise<BhawVendor[]> {
  const entries = await fetchBhawSnapshot();
  return entries
    .map((entry) => entry.vendor)
    .filter((vendor): vendor is BhawVendor => vendor !== null);
}

/** Picks one provider out of the feed by its `source` key. */
export function selectVendor(
  vendors: BhawVendor[],
  provider: BhawProvider | string,
): BhawVendor | null {
  return vendors.find((vendor) => vendor.source === provider) ?? null;
}

/**
 * One house's own "Gold Future MCX" sell, or null when it has not published
 * one. The house's bhaw is quoted over this line, so its RTGS and Cash are
 * built on it — whichever contract the house happens to quote.
 */
export function houseMcxSell(vendor: BhawVendor | null): number | null {
  if (!vendor) return null;
  const row = vendor.rows.find((entry) => /gold\s*future\s*mcx/i.test(entry.label));
  return row && row.sell !== null && Number.isFinite(row.sell) && row.sell > 0 ? row.sell : null;
}

/** Quotes within this share of each other are taken as the same contract. */
const SAME_CONTRACT_SPREAD = 0.004;

/**
 * The MCX figure most houses agree on. Each quote opens a window of the
 * quotes within SAME_CONTRACT_SPREAD above it (one contract); the window
 * holding the most houses wins, a tie going to the lower one, the near
 * month. A window, not fixed groups, so one stale low board cannot split a
 * real cluster and win the tie. Its lower median is returned — a real quote,
 * never an average across two contracts. Same rule as the server's
 * bhaw.service majorityMcx.
 */
export function majorityMcx(values: (number | null)[]): number | null {
  const quotes = values
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (quotes.length === 0) return null;
  let best: number[] = [];
  quotes.forEach((start, i) => {
    const window = quotes.filter(
      (quote, j) => j >= i && quote - start <= start * SAME_CONTRACT_SPREAD,
    );
    if (window.length > best.length) best = window;
  });
  return Math.round(best[Math.floor((best.length - 1) / 2)]);
}

/**
 * The market's MCX off the boards — the figure the Home card prints.
 *
 * The houses do not all quote the same contract: on 25 Sep 2026 JMD Patil's
 * "Gold Future MCX" was the December contract (1,54,2xx) while the other
 * three quoted the October near month (1,51,9xx), the figure market apps
 * show. This used to take the first house on the feed — JMD, for every shop
 * — so the card ran ~2,300 high. It is now the figure most houses agree on.
 */
export function feedMcxSell(vendors: BhawVendor[]): number | null {
  return majorityMcx(vendors.map(houseMcxSell));
}

/**
 * One sell figure off a house's board — "99.50 Gold Cash", "99.50 Gold RTGS" —
 * or null when that house has not published it. The Home tiles print these
 * over the bhaw, so the shop reads the rate and the premium behind it in one
 * glance, both straight from the board.
 */
export function boardSell(vendor: BhawVendor | null, label: RegExp): number | null {
  if (!vendor) return null;
  const row = vendor.rows.find((entry) => label.test(entry.label));
  return row && row.sell !== null && Number.isFinite(row.sell) ? row.sell : null;
}

/** Signed rupee value for display, e.g. "−3,200" / "+4,800". */
export function formatBhaw(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value < 0 ? '−' : '+';
  return `${sign}${Math.abs(Math.round(value)).toLocaleString('en-IN')}`;
}
