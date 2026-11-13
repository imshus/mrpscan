/**
 * Pins that any house on the feed is named by the feed, on Home and Gold
 * Rate Settings, and is never mistaken for a request.
 *
 * The feed grew from four houses to eleven (19 Oct 2026). The app named a
 * house off a four-house table, and Home's fallback read "Mega Bullion" for
 * every house but JMD Patil's; a house the server priced on but had no live
 * bhaw for came through as its bare key ("kj_bullion").
 *
 * utils/bullionNames.ts and utils/goldRateFigures.ts are loaded as the app
 * runs them, through node's type stripping (resolve hook as in
 * goldRateFigures.test.mjs).
 *
 * Run with:  node --test utils/__tests__/bullionNames.test.mjs
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

const { KNOWN_HOUSE_NAMES, houseNameFor, houseNameKey, isHouseOnList } = await import('@/utils/bullionNames');
const { parseBhawPayload } = await import('@/utils/bhawPayload');
const { computeGoldRateFigures, goldRateBase, goldRateChanges } = await import('@/utils/goldRateFigures');

/** The eleven houses on the feed on 19 Oct 2026, by key and feed name. */
const ELEVEN = [
  ['jmd_patil', 'JMD Patil'],
  ['mega_bullion', 'Mega Bullion'],
  ['shri_sai', 'Shri Sai Jewels'],
  ['shri_ganesh', 'Shri Ganesh Bullion'],
  ['smd_bullion', 'SMD Bullion'],
  ['shree_ram', 'Shree Ram Jewellers'],
  ['kp_bullion', 'KP Bullion'],
  ['vijaylaxmi_bullion', 'Vijaylaxmi Bullion'],
  ['kj_bullion', 'KJ Bullion'],
  ['sms_bullion', 'SMS Bullion'],
  ['sln_bullion', 'SLN Bullion'],
];

test('names: the server\'s name first, the known name while it has given none, never a bare key', () => {
  assert.equal(houseNameFor('smd_bullion', 'SMD Bullion'), 'SMD Bullion');
  // A name the feed changed wins over the table here.
  assert.equal(houseNameFor('kp_bullion', 'K.P. Bullion'), 'K.P. Bullion');
  // An older server named a house with no live bhaw by its key.
  assert.equal(houseNameFor('kj_bullion', 'kj_bullion'), 'KJ Bullion');
  for (const [key, name] of ELEVEN) assert.equal(houseNameFor(key), name, key);
  // A house the feed adds later, before anyone has named it.
  assert.equal(houseNameFor('new_house'), 'New House');
  assert.equal(houseNameFor('mega_bullion'), 'Mega Bullion');
  assert.equal(houseNameFor(''), '');
  assert.equal(Object.keys(KNOWN_HOUSE_NAMES).length, 11);
});

test('the list: a name on it is on it whatever its case or spacing, by name or by key', () => {
  const houses = ELEVEN.map(([key, label]) => ({ key, label }));
  assert.equal(houseNameKey('  Shree Ram   Jewellers '), 'shreeramjewellers');
  for (const typed of ['SMD Bullion', 'smd bullion', 'SMDBullion', ' smd_bullion ', 'shree ram jewellers']) {
    assert.equal(isHouseOnList(typed, houses), true, typed);
  }
  assert.equal(isHouseOnList('Gupta Jewellers', houses), false);
  assert.equal(isHouseOnList('gupta  jewellers', houses, ['Gupta Jewellers']), true, 'already asked for');
  assert.equal(isHouseOnList('   ', houses), false);
});

/** One board per house: MCX line, and RTGS where the house quotes it. */
const LINE = 148452;
const board = (source, name, rtgsSell = null) => ({
  source,
  name,
  timestamp: '2026-10-19T11:14:43+0530',
  rows: [
    { label: 'Gold Future MCX', buy: String(LINE - 16), sell: String(LINE) },
    { label: '99.50 Gold Cash', buy: null, sell: null },
    { label: '99.50 Gold RTGS', buy: rtgsSell === null ? null : String(rtgsSell - 1600), sell: rtgsSell === null ? null : String(rtgsSell) },
  ],
  cash_bhaw: null,
  rtgs_bhaw: rtgsSell === null ? null : rtgsSell - (LINE - 16),
});
const VENDORS = parseBhawPayload([
  board('jmd_patil', 'JMD Patil', 150652),
  board('smd_bullion', 'SMD Bullion', 150382),
  board('kj_bullion', 'KJ Bullion'),
]);

const goldResponse = (key, name = key) => ({
  mcxLiveRate: 148400,
  rates: [],
  taxSettings: {
    mcxChangeBy: 0, rtgsChangeBy: 0, cashChangeBy: 0, rtgsTaxPercent: 0, rtgsVariant: 'taxed', pricingMcxLiveRate: LINE,
  },
  supremeChanges: { cashChange: -111, rtgsChange: 111 },
  bhawSource: { key, name, live: key !== 'kj_bullion' },
});

test('Home and Gold Rate Settings: a new house is named by the feed and priced off its own board', () => {
  const smd = goldRateBase(goldResponse('smd_bullion', 'SMD Bullion'), VENDORS, null);
  assert.equal(smd.houseName, 'SMD Bullion');
  assert.deepEqual([smd.rtgsLive, smd.cashLive], [true, false], 'RTGS only, as Shri Sai');
  const figures = computeGoldRateFigures(smd, goldRateChanges(goldResponse('smd_bullion')));
  assert.equal(figures.rtgsRate1, 150382, 'SMD\'s own RTGS sell');
  assert.equal(figures.retailFinal, null, 'no Cash on its board: no Retail, as for Shri Sai');

  // No bhaw at all, as Mega Bullion: named, neither side priced on screen.
  const kj = goldRateBase(goldResponse('kj_bullion', 'KJ Bullion'), VENDORS, null);
  assert.equal(kj.houseName, 'KJ Bullion');
  assert.equal(kj.houseLive, false);

  // The boards out (cold start): named as the server named it, or known.
  assert.equal(goldRateBase(goldResponse('kp_bullion', 'KP Bullion'), [], null).houseName, 'KP Bullion');
  assert.equal(goldRateBase(goldResponse('sln_bullion', 'sln_bullion'), [], null).houseName, 'SLN Bullion');
});
