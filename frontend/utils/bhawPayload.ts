/**
 * The dealer boards as the live stream sends them, and how they are read.
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/bhawStream.test.mjs, so what is tested is what the app
 * runs. utils/bhawApi.ts re-exports everything here.
 *
 * Each snapshot is either a bare ARRAY of every house the feed carries, or
 * an object with that array under `sources` (the 3-minute feed's shape):
 *
 *   [ { source: 'jmd_patil', name, timestamp, ok, error,
 *       rows: [ { label: 'Gold Future MCX', buy, sell, high, low, note }, … ],
 *       cash_bhaw, rtgs_bhaw, … }, … ]
 *
 * Callers pick the house the business selected by `source`, never by array
 * position. Figures may arrive as numeric strings ("-3200"), hence the
 * coercion below.
 */

/** One line of a house's published board: "99.50 Gold Cash", sell 150400. */
export interface BhawRow {
  label: string;
  buy: number | null;
  sell: number | null;
}

export interface BhawVendor {
  /** The house's key — one of BHAW_PROVIDERS in utils/bhawApi.ts. */
  source: string;
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

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    // "1,53,052" reads as the server reads it; the sign stays.
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeVendor(raw: unknown): BhawVendor | null {
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

/**
 * One snapshot's houses, from its JSON text or the parsed value.
 *
 * Null when it is not a snapshot at all — not JSON, or neither an array nor
 * an object with a `sources` array (a heartbeat's {"type":"heartbeat"}) —
 * and the caller ignores it. A house the feed could not read this round
 * (`ok: false`) is left out; an empty array means none could be read.
 */
export function parseBhawPayload(raw: unknown): BhawVendor[] | null {
  let payload = raw;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }

  let sources: unknown[] | null = null;
  if (Array.isArray(payload)) {
    sources = payload;
  } else if (payload && typeof payload === 'object') {
    const nested = (payload as { sources?: unknown }).sources;
    if (Array.isArray(nested)) sources = nested;
  }
  if (!sources) return null;

  return sources
    .filter((entry) => !(entry && typeof entry === 'object' && (entry as { ok?: unknown }).ok === false))
    .map(normalizeVendor)
    .filter((vendor): vendor is BhawVendor => vendor !== null);
}
