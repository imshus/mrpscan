/**
 * Live bhaw feed — the premium/discount each bullion house quotes over MCX.
 *
 *   GET https://17gdivfex7.execute-api.ap-south-1.amazonaws.com/bhaw
 *   -> [ { source: 'jmd_patil',    name, cash_bhaw, rtgs_bhaw, rows, timestamp },
 *        { source: 'mega_bullion', name, cash_bhaw, rtgs_bhaw, rows, timestamp } ]
 *
 * The endpoint returns an ARRAY containing EVERY provider, so callers pick the
 * one the business selected by `source` rather than trusting array position.
 * Values arrive as numeric strings ("-3200"), hence the coercion below.
 */

const BHAW_URL = 'https://17gdivfex7.execute-api.ap-south-1.amazonaws.com/bhaw';

/** Every 30 seconds, at the shop's asking: a bhaw that moved is money. */
export const BHAW_POLL_INTERVAL_MS = 30_000;
const BHAW_TIMEOUT_MS = 8_000;

export const BHAW_PROVIDERS = {
  JMD_PATIL: 'jmd_patil',
  MEGA_BULLION: 'mega_bullion',
  SHRI_SAI: 'shri_sai',
  SHRI_GANESH: 'shri_ganesh',
} as const;

export type BhawProvider = (typeof BHAW_PROVIDERS)[keyof typeof BHAW_PROVIDERS];

/** One line of a house's published board: "99.50 Gold Cash", sell 150400. */
export interface BhawRow {
  label: string;
  buy: number | null;
  sell: number | null;
}

export interface BhawVendor {
  source: BhawProvider | string;
  name: string;
  /**
   * Premium (+) or discount (−) over MCX, in rupees.
   *
   * Null when the house has not published that side today — several quote
   * only MCX until their counter opens. Null is not zero: zero would mean
   * "no premium" and would misprice every item, so anything that computes a
   * rate must treat null as "no live figure" and fall back.
   */
  cashBhaw: number | null;
  rtgsBhaw: number | null;
  /** The house's own board, shown on the Dashboard Settings card. */
  rows: BhawRow[];
  updatedAt: string;
}

/** True when this house has published both sides and can price a scan. */
export function hasLiveBhaw(vendor: BhawVendor | null): boolean {
  return vendor !== null && vendor.cashBhaw !== null && vendor.rtgsBhaw !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    // "1,53,052" reads as the server reads it; the sign stays.
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeVendor(raw: unknown): BhawVendor | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;

  const source = typeof row.source === 'string' ? row.source.toLowerCase() : '';
  const cashBhaw = toNumber(row.cash_bhaw);
  const rtgsBhaw = toNumber(row.rtgs_bhaw);

  // Only a house with no identity at all is dropped. One that has not
  // published its bhaw yet is kept, with nulls: Dashboard Settings lists
  // every house the feed carries, and showing a dash against one is how a
  // shop sees that it has nothing to follow there yet. Pricing refuses a
  // null separately — see hasLiveBhaw.
  if (!source) return null;

  const rows = Array.isArray(row.rows)
    ? row.rows
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
        .map((entry) => ({
          label: typeof entry.label === 'string' ? entry.label : '',
          buy: toNumber(entry.buy),
          sell: toNumber(entry.sell),
        }))
        .filter((entry) => entry.label)
    : [];

  return {
    source,
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : source,
    rows,
    cashBhaw,
    rtgsBhaw,
    updatedAt: typeof row.timestamp === 'string' ? row.timestamp : '',
  };
}

/** Fetches every provider the feed publishes. Throws on network/HTTP failure. */
export async function fetchBhawVendors(): Promise<BhawVendor[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BHAW_TIMEOUT_MS);
  try {
    // Cache-proofed both ways: RN's fetch on Android happily re-serves a
    // cached GET, which left the boards frozen on old figures while the feed
    // moved. The headers refuse the cache and the timestamped URL makes each
    // poll a request nothing has ever cached.
    const response = await fetch(`${BHAW_URL}?t=${Date.now()}`, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
      },
    });
    if (!response.ok) throw new Error(`Bhaw API returned ${response.status}`);

    const payload: unknown = await response.json();
    // Tolerate a bare object in case the upstream shape changes back.
    const rows = Array.isArray(payload) ? payload : [payload];
    return rows.map(normalizeVendor).filter((v): v is BhawVendor => v !== null);
  } finally {
    clearTimeout(timer);
  }
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
