/**
 * Live Bhaw (gold rate premium/discount) feed.
 *
 * Contract (see design-mockup/README.md):
 *   GET https://17gdivfex7.execute-api.ap-south-1.amazonaws.com/bhaw
 *   -> { source, name, cash_bhaw, rtgs_bhaw, updated_at }
 *
 * Always returns whichever vendor is currently "active" (selection is
 * managed by a separate internal admin dashboard). MRPscan only ever
 * needs this one read-only GET, polled every 30s while Home is visible.
 */

const BHAW_URL = 'https://17gdivfex7.execute-api.ap-south-1.amazonaws.com/bhaw';

export const BHAW_POLL_INTERVAL_MS = 30_000;

export interface BhawData {
  source: string;
  name: string;
  /** The API may serialize these as numbers or numeric strings; null when a vendor hasn't updated yet. */
  cash_bhaw: number | string | null;
  rtgs_bhaw: number | string | null;
  updated_at: string;
}

export async function fetchBhaw(): Promise<BhawData> {
  const res = await fetch(BHAW_URL);
  if (!res.ok) {
    throw new Error(`Bhaw API returned ${res.status}`);
  }
  return (await res.json()) as BhawData;
}

/** Formats a bhaw value as a signed en-IN number, or an em-dash when absent. */
export function formatBhaw(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  return (num < 0 ? '−' : '+') + Math.abs(num).toLocaleString('en-IN');
}
