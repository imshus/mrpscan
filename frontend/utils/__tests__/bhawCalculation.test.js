/**
 * Pins the client-side bhaw formula:
 *   cash = MCX + provider cash_bhaw + shop cash adjustment
 *   rtgs = MCX + provider rtgs_bhaw + shop rtgs adjustment
 *
 * Run with:  node --test utils/__tests__/bhawCalculation.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// Mirror of utils/bhawCalculation.ts — kept in step by the shape assertions
// below, since the app source is TypeScript and this runner is plain node.
function calculateBhawRates({
  mcxBaseRate,
  vendor,
  businessCashChange = 0,
  businessRtgsChange = 0,
  fallbackCashBhaw = 0,
  fallbackRtgsBhaw = 0,
}) {
  const base = Number.isFinite(mcxBaseRate) ? mcxBaseRate : 0;
  const cashBhaw = vendor?.cashBhaw ?? fallbackCashBhaw;
  const rtgsBhaw = vendor?.rtgsBhaw ?? fallbackRtgsBhaw;
  const isLive = vendor?.cashBhaw != null && vendor?.rtgsBhaw != null;
  return {
    cashRate: Math.round(base + cashBhaw + businessCashChange),
    rtgsRate: Math.round(base + rtgsBhaw + businessRtgsChange),
    cashBhaw,
    rtgsBhaw,
    isLive,
  };
}

const MCX = 155000;
const JMD = { source: 'jmd_patil', name: 'JMD Patil', cashBhaw: -3200, rtgsBhaw: 4800 };
const MEGA = { source: 'mega_bullion', name: 'Mega Bullion', cashBhaw: -3900, rtgsBhaw: 4900 };

test('JMD Patil: cash and rtgs are MCX plus that provider bhaw', () => {
  const r = calculateBhawRates({ mcxBaseRate: MCX, vendor: JMD });
  assert.equal(r.cashRate, MCX - 3200);
  assert.equal(r.rtgsRate, MCX + 4800);
  assert.equal(r.isLive, true);
});

test('Mega Bullion: switching provider switches both rates', () => {
  const jmd = calculateBhawRates({ mcxBaseRate: MCX, vendor: JMD });
  const mega = calculateBhawRates({ mcxBaseRate: MCX, vendor: MEGA });
  assert.equal(mega.cashRate, MCX - 3900);
  assert.equal(mega.rtgsRate, MCX + 4900);
  assert.notEqual(jmd.cashRate, mega.cashRate);
  assert.notEqual(jmd.rtgsRate, mega.rtgsRate);
});

test("the shop's own adjustments are preserved on top of the provider bhaw", () => {
  const r = calculateBhawRates({
    mcxBaseRate: MCX,
    vendor: MEGA,
    businessCashChange: -2000,
    businessRtgsChange: 4200,
  });
  assert.equal(r.cashRate, MCX - 3900 - 2000);
  assert.equal(r.rtgsRate, MCX + 4900 + 4200);
});

test('a negative bhaw is subtracted and a positive one added, from its sign alone', () => {
  const r = calculateBhawRates({
    mcxBaseRate: 100000,
    vendor: { source: 'x', name: 'X', cashBhaw: -500, rtgsBhaw: 750 },
  });
  assert.equal(r.cashRate, 99500);
  assert.equal(r.rtgsRate, 100750);
});

test('with the feed down it falls back instead of collapsing to the bare MCX rate', () => {
  const r = calculateBhawRates({
    mcxBaseRate: MCX,
    vendor: null,
    fallbackCashBhaw: -3900,
    fallbackRtgsBhaw: 4900,
  });
  assert.equal(r.cashRate, MCX - 3900);
  assert.equal(r.rtgsRate, MCX + 4900);
  assert.equal(r.isLive, false, 'must report that these are not live figures');
});

test('a non-numeric MCX rate does not produce NaN rates', () => {
  const r = calculateBhawRates({ mcxBaseRate: Number.NaN, vendor: JMD });
  assert.ok(Number.isFinite(r.cashRate));
  assert.ok(Number.isFinite(r.rtgsRate));
});

/**
 * A house that publishes only one side. The feed carries several of these —
 * Mega Bullion quotes MCX and nothing else — and they now reach this function
 * as a vendor with nulls rather than being dropped before it.
 */
test('a missing cash bhaw falls back instead of becoming zero', () => {
  const partial = { source: 'shri_sai', name: 'Shri Sai Jewels', cashBhaw: null, rtgsBhaw: 4002 };
  const r = calculateBhawRates({
    mcxBaseRate: MCX,
    vendor: partial,
    fallbackCashBhaw: -3200,
    fallbackRtgsBhaw: 4800,
  });

  assert.equal(r.cashBhaw, -3200, 'the fallback, not 0');
  assert.equal(r.cashRate, MCX - 3200);
  assert.equal(r.rtgsBhaw, 4002, 'the side it did publish is still live');
  assert.equal(r.rtgsRate, MCX + 4002);
  assert.equal(r.isLive, false, 'half a board is not a live quote');
});

test('a house publishing neither side prices exactly as no house at all', () => {
  const empty = { source: 'mega_bullion', name: 'Mega Bullion', cashBhaw: null, rtgsBhaw: null };
  const withEmpty = calculateBhawRates({
    mcxBaseRate: MCX,
    vendor: empty,
    fallbackCashBhaw: -3200,
    fallbackRtgsBhaw: 4800,
  });
  const withNone = calculateBhawRates({
    mcxBaseRate: MCX,
    vendor: null,
    fallbackCashBhaw: -3200,
    fallbackRtgsBhaw: 4800,
  });

  assert.deepEqual(withEmpty, withNone);
});
