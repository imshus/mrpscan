/**
 * Pins what an employee's Settings tile says about the shop's subscription
 * (utils/subscriptionSummary.ts): the plan line in the owner's screens' own
 * words, the en-IN credits line, the placeholders while loading, and the
 * fall-back to the GSTIN line when the summary cannot be had.
 *
 * The module has no imports, so node loads the app's own file directly
 * (type stripping, Node 22.18+ / 24) — no mirrored copy to drift.
 *
 * Run with:  node --test utils/__tests__/subscriptionSummary.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SUMMARY_PLACEHOLDER,
  creditsLabel,
  formatCredits,
  planLabel,
  subscriptionTileLines,
  toSubscriptionSummary,
  trialTimeLabel,
} from '../subscriptionSummary.ts';

const NOW = Date.parse('2026-10-07T10:00:00.000Z');
const HOUR = 3_600_000;

function summary(overrides) {
  return toSubscriptionSummary({
    status: 'NO_LICENSE',
    trialStatus: 'NOT_STARTED',
    trialDaysRemaining: 0,
    trialEndDate: null,
    applicationPurchased: false,
    permanentActivatedAt: null,
    creditBalance: 0,
    ...overrides,
  });
}

test('plan: a bought licence is "Permanent License"', () => {
  assert.equal(planLabel(summary({ status: 'PERMANENT_LICENSE', applicationPurchased: true }), NOW), 'Permanent License');
  // Either signal is enough, and the older server name maps the same way.
  assert.equal(planLabel(summary({ applicationPurchased: true }), NOW), 'Permanent License');
  assert.equal(planLabel(summary({ status: 'PURCHASED' }), NOW), 'Permanent License');
  // A shop that ran a trial and then bought is not "expired".
  assert.equal(
    planLabel(summary({ status: 'PERMANENT_LICENSE', trialStatus: 'EXPIRED' }), NOW),
    'Permanent License',
  );
});

test('plan: a running trial counts down the way Credits & Subscription does', () => {
  const trial = (days, endsInMs) =>
    summary({
      status: 'FREE_TRIAL_LICENSE',
      trialStatus: 'ACTIVE',
      trialDaysRemaining: days,
      trialEndDate: endsInMs == null ? null : new Date(NOW + endsInMs).toISOString(),
    });

  assert.equal(planLabel(trial(5, 5 * 24 * HOUR), NOW), 'Free Trial · 5 days remaining');
  assert.equal(planLabel(trial(1, 30 * HOUR), NOW), 'Free Trial · 1 day remaining');
  // Under half a day the server's count is 0: hours, ceiled like the server's.
  assert.equal(planLabel(trial(0, 5 * HOUR + 1), NOW), 'Free Trial · 6 hours remaining');
  assert.equal(planLabel(trial(0, HOUR), NOW), 'Free Trial · 1 hour remaining');
  assert.equal(planLabel(trial(0, -1000), NOW), 'Free Trial · Less than 1 hour remaining');
  // No end date to count from: the plan alone, never a made-up countdown.
  assert.equal(planLabel(trial(0, null), NOW), 'Free Trial');
  // The older server name.
  assert.equal(planLabel(summary({ status: 'FREE_TRIAL', trialDaysRemaining: 3 }), NOW), 'Free Trial · 3 days remaining');
});

test('trialTimeLabel: the countdown Credits & Subscription shows', () => {
  assert.equal(trialTimeLabel(7, 0), '7 days remaining');
  assert.equal(trialTimeLabel(1, 20), '1 day remaining');
  assert.equal(trialTimeLabel(0, 2), '2 hours remaining');
  assert.equal(trialTimeLabel(0, 1), '1 hour remaining');
  assert.equal(trialTimeLabel(0, 0), 'Less than 1 hour remaining');
});

test('plan: an ended trial says so; never started is "No License"', () => {
  assert.equal(planLabel(summary({ trialStatus: 'EXPIRED' }), NOW), 'Free trial expired');
  assert.equal(planLabel(summary({ status: 'EXPIRED', trialStatus: undefined }), NOW), 'Free trial expired');
  // A server that sends trialExpiredAt instead of trialStatus.
  assert.equal(
    planLabel(summary({ trialStatus: undefined, trialExpiredAt: '2026-10-01T00:00:00.000Z' }), NOW),
    'Free trial expired',
  );
  assert.equal(planLabel(summary({}), NOW), 'No License');
  assert.equal(planLabel(summary({ status: 'NO_SUBSCRIPTION' }), NOW), 'No License');
  assert.equal(planLabel(toSubscriptionSummary({}), NOW), 'No License');
});

test('summary: missing or junk fields read safely', () => {
  const s = toSubscriptionSummary({ status: 'SOMETHING_NEW', creditBalance: 'abc', trialDaysRemaining: -3 });
  assert.equal(s.status, 'NO_LICENSE');
  assert.equal(s.trialStatus, 'NOT_STARTED');
  assert.equal(s.creditBalance, 0);
  assert.equal(s.trialDaysRemaining, 0);
  assert.equal(s.trialEndDate, null);
  assert.equal(s.applicationPurchased, false);
  assert.deepEqual(toSubscriptionSummary(null), toSubscriptionSummary({}));
  // Only the fields the tile needs are kept, whatever else arrives.
  assert.deepEqual(
    Object.keys(toSubscriptionSummary({ purchaseOrderId: 'order_x', purchaseAmount: 12000 })).sort(),
    [
      'applicationPurchased',
      'creditBalance',
      'permanentActivatedAt',
      'status',
      'trialDaysRemaining',
      'trialEndDate',
      'trialStatus',
    ],
  );
});

test('credits: grouped the Indian way', () => {
  assert.equal(formatCredits(1240), '1,240');
  assert.equal(formatCredits(124000), '1,24,000');
  assert.equal(formatCredits(0), '0');
  // The paise a scan leaves behind show as money does, two places.
  assert.equal(formatCredits(1240.5), '1,240.50');
  assert.equal(formatCredits(99.3199), '99.32');
  assert.equal(formatCredits(12.004), '12');
  assert.equal(creditsLabel(1240), 'Credits: 1,240');
  assert.equal(creditsLabel(null), `Credits: ${SUMMARY_PLACEHOLDER}`);
  assert.equal(creditsLabel(undefined), 'Credits: —');
});

test('tile lines: placeholders, then the summary, else the GSTIN line', () => {
  // Loading: the shop name is up already; both lines wait.
  assert.deepEqual(subscriptionTileLines(null, false, NOW), { plan: '—', credits: 'Credits: —' });
  // First fetch failed: null, so the screen shows today's GSTIN line.
  assert.equal(subscriptionTileLines(null, true, NOW), null);

  const bought = summary({ status: 'PERMANENT_LICENSE', creditBalance: 1240 });
  assert.deepEqual(subscriptionTileLines(bought, false, NOW), {
    plan: 'Permanent License',
    credits: 'Credits: 1,240',
  });
  // A refetch that fails keeps what was last received.
  assert.deepEqual(subscriptionTileLines(bought, true, NOW), {
    plan: 'Permanent License',
    credits: 'Credits: 1,240',
  });
});
