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

/** Long enough to be current, short enough not to hammer the endpoint. */
export const BHAW_POLL_INTERVAL_MS = 60_000;
const BHAW_TIMEOUT_MS = 8_000;

export const BHAW_PROVIDERS = {
  JMD_PATIL: 'jmd_patil',
  MEGA_BULLION: 'mega_bullion',
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
    const parsed = Number(value);
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
    const response = await fetch(BHAW_URL, { signal: controller.signal });
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
  provider: BhawProvider,
): BhawVendor | null {
  return vendors.find((vendor) => vendor.source === provider) ?? null;
}

/** Signed rupee value for display, e.g. "−3,200" / "+4,800". */
export function formatBhaw(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value < 0 ? '−' : '+';
  return `${sign}${Math.abs(Math.round(value)).toLocaleString('en-IN')}`;
}
