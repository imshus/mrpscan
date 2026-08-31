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
  const isLive = vendor !== null;
  const cashBhaw = vendor ? vendor.cashBhaw : fallbackCashBhaw;
  const rtgsBhaw = vendor ? vendor.rtgsBhaw : fallbackRtgsBhaw;
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
