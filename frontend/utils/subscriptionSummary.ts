/**
 * The shop's plan and credits as an employee's Settings tile states them,
 * read from GET /subscription/summary (the part of the owner's overview an
 * employee may see: no payments, amounts or invoices).
 *
 * The wording is the owner's own screens': the status names on Credits &
 * Subscription ("Permanent License", "No License"), its trial countdown
 * ("5 days remaining", trialTimeLabel below, which that screen now shares),
 * "Free Trial" from the Purchase screen's panel, and "Free trial expired"
 * from the scanner's alert. An employee and the owner read the same words for
 * the same state.
 *
 * No imports on purpose — node loads this file as-is (type stripping) for
 * utils/__tests__/subscriptionSummary.test.mjs, so what is tested is what the
 * app runs.
 */

export type SubscriptionSummaryStatus =
  | 'NO_LICENSE'
  | 'FREE_TRIAL_LICENSE'
  | 'PERMANENT_LICENSE'
  | 'EXPIRED';

export type SubscriptionSummaryTrialStatus = 'NOT_STARTED' | 'ACTIVE' | 'EXPIRED';

export interface SubscriptionSummary {
  status: SubscriptionSummaryStatus;
  trialStatus: SubscriptionSummaryTrialStatus;
  trialDaysRemaining: number;
  trialEndDate: string | null;
  applicationPurchased: boolean;
  permanentActivatedAt: string | null;
  creditBalance: number;
}

/** What a line says while the summary is still on its way. */
export const SUMMARY_PLACEHOLDER = '—';

const KNOWN_STATUSES: readonly SubscriptionSummaryStatus[] = [
  'NO_LICENSE',
  'FREE_TRIAL_LICENSE',
  'PERMANENT_LICENSE',
  'EXPIRED',
];

const TRIAL_STATUSES: readonly SubscriptionSummaryTrialStatus[] = ['NOT_STARTED', 'ACTIVE', 'EXPIRED'];

/** The server's older names map the way subscriptionApi's overview maps them. */
function normalizeStatus(raw: unknown): SubscriptionSummaryStatus {
  const value = String(raw ?? '').trim();
  if (value === 'NO_SUBSCRIPTION') return 'NO_LICENSE';
  if (value === 'FREE_TRIAL') return 'FREE_TRIAL_LICENSE';
  if (value === 'PURCHASED') return 'PERMANENT_LICENSE';
  return (KNOWN_STATUSES as readonly string[]).includes(value)
    ? (value as SubscriptionSummaryStatus)
    : 'NO_LICENSE';
}

function finiteOr(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** The response's data, made safe to read whatever the server left out. */
export function toSubscriptionSummary(raw: Record<string, unknown> | null | undefined): SubscriptionSummary {
  const source = raw && typeof raw === 'object' ? raw : {};
  const status = normalizeStatus(source.status);

  let trialStatus: SubscriptionSummaryTrialStatus;
  if ((TRIAL_STATUSES as readonly unknown[]).includes(source.trialStatus)) {
    trialStatus = source.trialStatus as SubscriptionSummaryTrialStatus;
  } else if (status === 'FREE_TRIAL_LICENSE') {
    trialStatus = 'ACTIVE';
  } else if (source.trialExpiredAt || status === 'EXPIRED') {
    trialStatus = 'EXPIRED';
  } else {
    trialStatus = 'NOT_STARTED';
  }

  return {
    status,
    trialStatus,
    trialDaysRemaining: Math.max(0, finiteOr(source.trialDaysRemaining, 0)),
    trialEndDate: stringOrNull(source.trialEndDate),
    applicationPurchased: status === 'PERMANENT_LICENSE' || source.applicationPurchased === true,
    permanentActivatedAt: stringOrNull(source.permanentActivatedAt),
    creditBalance: finiteOr(source.creditBalance, 0),
  };
}

/**
 * The trial countdown on Credits & Subscription: whole days while there are
 * any, then hours, then the last hour.
 */
export function trialTimeLabel(days: number, hours: number): string {
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} remaining`;
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} remaining`;
  return 'Less than 1 hour remaining';
}

/** "Permanent License", "Free Trial · 5 days remaining", "Free trial expired" or "No License". */
export function planLabel(summary: SubscriptionSummary, nowMs: number = Date.now()): string {
  if (summary.applicationPurchased || summary.status === 'PERMANENT_LICENSE') {
    return 'Permanent License';
  }
  if (summary.status === 'FREE_TRIAL_LICENSE') {
    const days = Math.round(summary.trialDaysRemaining);
    if (days > 0) return `Free Trial · ${trialTimeLabel(days, 0)}`;
    // The summary carries the end date rather than the hours; worked the way
    // the server works trialHoursRemaining (ceiled, so "1 hour" is not "0").
    const endsAt = summary.trialEndDate ? Date.parse(summary.trialEndDate) : NaN;
    if (!Number.isFinite(endsAt)) return 'Free Trial';
    const hours = Math.max(0, Math.ceil((endsAt - nowMs) / 3_600_000));
    return `Free Trial · ${trialTimeLabel(0, hours)}`;
  }
  if (summary.trialStatus === 'EXPIRED' || summary.status === 'EXPIRED') {
    return 'Free trial expired';
  }
  return 'No License';
}

/**
 * The wallet's balance as a count, grouped the Indian way: "1,240", or
 * "1,240.50" for the paise a scan leaves behind.
 */
export function formatCredits(balance: number): string {
  const value = Math.round(finiteOr(balance, 0) * 100) / 100;
  return Number.isInteger(value)
    ? value.toLocaleString('en-IN', { maximumFractionDigits: 0 })
    : value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "Credits: 1,240", or "Credits: —" while the balance is not known yet. */
export function creditsLabel(balance: number | null | undefined): string {
  if (balance === null || balance === undefined) return `Credits: ${SUMMARY_PLACEHOLDER}`;
  return `Credits: ${formatCredits(balance)}`;
}

/**
 * The two lines under the shop's name on an employee's tile. Placeholders
 * while the first fetch is out; null once it has failed with nothing to
 * show, so the tile falls back to its GSTIN line.
 */
export function subscriptionTileLines(
  summary: SubscriptionSummary | null,
  failed: boolean,
  nowMs: number = Date.now(),
): { plan: string; credits: string } | null {
  if (summary) {
    return { plan: planLabel(summary, nowMs), credits: creditsLabel(summary.creditBalance) };
  }
  if (failed) return null;
  return { plan: SUMMARY_PLACEHOLDER, credits: creditsLabel(null) };
}
