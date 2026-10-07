/**
 * Pins that the gold figures Home and Gold Rate Settings print stand on the
 * followed house's own board: with no shop changes, Retail is the house's
 * "99.50 Gold Cash" sell and RTGS Rate 1 its "99.50 Gold RTGS" sell, to the
 * rupee — not those plus the house's MCX spread, as when the feed's Badla
 * Bhaw (measured from the MCX buy) was added to the MCX sell.
 *
 * The app's own files are loaded, not a mirror: utils/goldRateFigures.ts and
 * utils/bhawCalculation.ts through node's type stripping, with a resolve hook
 * for the '@/' alias and extensionless imports, and two one-line stand-ins
 * for the only native modules on the way (react-native's Platform and
 * expo/fetch, which utils/sseClient.ts imports and these figures never call).
 *
 * Run with:  node --test utils/__tests__/goldRateFigures.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const STANDINS = {
  'react-native': "export const Platform = { OS: 'node' };",
  'expo/fetch': "export function fetch() { throw new Error('no network in tests'); }",
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(STANDINS, specifier)) {
      return { url: `data:text/javascript,${encodeURIComponent(STANDINS[specifier])}`, shortCircuit: true };
    }
    let file = null;
    if (specifier.startsWith('@/')) file = path.join(ROOT, specifier.slice(2));
    else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      file = path.join(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (file === null) return nextResolve(specifier, context);
    if (!path.extname(file)) file = ['.ts', '.tsx'].map((ext) => file + ext).find(existsSync) ?? file;
    const format = file.endsWith('.ts') ? 'module-typescript' : undefined;
    return { url: pathToFileURL(file).href, format, shortCircuit: true };
  },
});

const { parseBhawPayload } = await import('@/utils/bhawPayload');
const { houseMcxSell } = await import('@/utils/bhawApi');
const { calculateBhawRates } = await import('@/utils/bhawCalculation');
const { computeGoldRateFigures, goldRateBase, goldRateChanges } = await import('@/utils/goldRateFigures');

// One live frame (jmd.mrpscan.com/api/stream, 7 Oct 2026, 10:09:46), the
// three houses as sent, all_rows left out.
const LIVE_FRAME = [
  {
    source: 'jmd_patil',
    name: 'JMD Patil',
    timestamp: '2026-10-07T10:09:46+0530',
    rows: [
      { label: 'Gold Future MCX', buy: '149454', sell: '149471', high: '149736', low: '149400', note: null },
      { label: '99.50 Gold Cash', buy: '147271', sell: '148271', high: '150100', low: '148208', note: null },
      { label: '99.50 Gold RTGS', buy: '150221', sell: '151721', high: '153550', low: '151658', note: null },
    ],
    cash_bhaw: -1183,
    rtgs_bhaw: 2267,
    ok: true,
    error: null,
  },
  {
    source: 'mega_bullion',
    name: 'Mega Bullion',
    timestamp: '2026-10-07T10:09:47+0530',
    rows: [
      { label: 'Gold Future MCX', buy: '149454', sell: '149470', high: '149736', low: '149400', note: null },
      { label: '99.50 Gold Cash', buy: null, sell: null, high: null, low: null, note: null },
      { label: '99.50 Gold RTGS', buy: null, sell: null, high: null, low: null, note: null },
    ],
    cash_bhaw: null,
    rtgs_bhaw: null,
    ok: true,
    error: null,
  },
  {
    source: 'shri_sai',
    name: 'Shri Sai Jewels',
    timestamp: '2026-10-07T10:09:46+0530',
    rows: [
      { label: 'Gold Future MCX', buy: '149454', sell: '149470', high: '149736', low: '149400', note: null },
      { label: '99.50 Gold Cash', buy: null, sell: null, high: null, low: null, note: null },
      { label: '99.50 Gold RTGS', buy: '-', sell: '151820', high: '153600', low: '151758', note: null },
    ],
    cash_bhaw: null,
    rtgs_bhaw: 2366,
    ok: true,
    error: null,
  },
];

const VENDORS = parseBhawPayload(LIVE_FRAME);

/** The server's response as the phone reads it, priced on `key`. */
function goldResponse(key, taxSettings = {}) {
  return {
    mcxLiveRate: 149300,
    rates: [],
    taxSettings: {
      mcxChangeBy: 0,
      rtgsChangeBy: 0,
      cashChangeBy: 0,
      rtgsTaxPercent: 0,
      rtgsVariant: 'taxed',
      pricingMcxLiveRate: 149300,
      ...taxSettings,
    },
    // The server's fallback bhaw: what a side the house has not published
    // would stand on. Deliberately unlike any board figure.
    supremeChanges: { cashChange: -999, rtgsChange: 999 },
    bhawSource: { key, name: key, live: true },
  };
}

function figuresFor(key, taxSettings) {
  const gold = goldResponse(key, taxSettings);
  return computeGoldRateFigures(goldRateBase(gold, VENDORS, null), goldRateChanges(gold));
}

test('figures: with no shop changes, Retail and RTGS Rate 1 are the house\'s own sells', () => {
  const jmd = figuresFor('jmd_patil');
  assert.equal(jmd.mcxFinal, 149471, 'the house\'s MCX sell');
  assert.equal(jmd.retailFinal, 148271, 'JMD "99.50 Gold Cash" sell');
  assert.equal(jmd.rtgsRate1, 151721, 'JMD "99.50 Gold RTGS" sell');
  assert.equal(jmd.rtgsRate2, 151721, 'tax 0: Rate 2 is Rate 1');
  assert.equal(jmd.rtgsSelected, 151721);

  // A house that quotes RTGS and no cash: RTGS to the rupee, no Retail.
  const sai = figuresFor('shri_sai');
  assert.equal(sai.rtgsRate1, 151820, 'Shri Sai "99.50 Gold RTGS" sell');
  assert.equal(sai.retailFinal, null);

  // A house with MCX alone prices neither side.
  const mega = figuresFor('mega_bullion');
  assert.deepEqual([mega.mcxFinal, mega.retailFinal, mega.rtgsRate1], [149470, null, null]);
});

test('figures: the shop\'s changes and tax still go on top of the house\'s sells', () => {
  const jmd = figuresFor('jmd_patil', {
    mcxChangeBy: 100,
    cashChangeBy: 50,
    rtgsChangeBy: -25,
    rtgsTaxPercent: 3,
    rtgsVariant: 'plain',
  });
  assert.equal(jmd.mcxFinal, 149471 + 100);
  assert.equal(jmd.retailFinal, 148271 + 100 + 50);
  assert.equal(jmd.rtgsRate1, 151721 + 100 - 25);
  assert.equal(jmd.rtgsRate2, Math.round((151721 + 100 - 25) / 1.03));
  assert.equal(jmd.rtgsSelected, jmd.rtgsRate2);
});

test('figures: the feed\'s Badla Bhaw would have run each rate high by the MCX spread', () => {
  const jmd = VENDORS.find((v) => v.source === 'jmd_patil');
  const base = goldRateBase(goldResponse('jmd_patil'), VENDORS, null);
  assert.deepEqual([base.cashBhaw, base.rtgsBhaw], [-1200, 2250]);
  // What the card prints, and what the old arithmetic added: 17 high.
  assert.equal(base.pricingMcx + jmd.boardCashBhaw, 148271 + 17);
  assert.equal(base.pricingMcx + jmd.boardRtgsBhaw, 151721 + 17);
});

test('bhaw rates: the store\'s cash/RTGS on the house line are its own sells', () => {
  for (const vendor of VENDORS) {
    const sells = Object.fromEntries(vendor.rows.map((r) => [r.label, r.sell]));
    const rates = calculateBhawRates({
      mcxBaseRate: houseMcxSell(vendor),
      vendor,
      fallbackCashBhaw: -999,
      fallbackRtgsBhaw: 999,
    });
    if (vendor.cashBhaw !== null) assert.equal(rates.cashRate, sells['99.50 Gold Cash'], vendor.source);
    if (vendor.rtgsBhaw !== null) assert.equal(rates.rtgsRate, sells['99.50 Gold RTGS'], vendor.source);
  }
});
