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

export interface BhawVendor {
  source: BhawProvider | string;
  name: string;
  /** Premium (+) or discount (−) over MCX for cash settlement, in rupees. */
  cashBhaw: number;
  /** Premium (+) or discount (−) over MCX for RTGS settlement, in rupees. */
  rtgsBhaw: number;
  updatedAt: string;
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

  // A provider that has not published yet must not silently become 0, which
  // would read as "no premium" and misprice every item.
  if (!source || cashBhaw === null || rtgsBhaw === null) return null;

  return {
    source,
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : source,
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
