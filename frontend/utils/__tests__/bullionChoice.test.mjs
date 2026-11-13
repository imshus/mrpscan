/**
 * Pins Choose a Bullion's answers-in-any-order rules, Home's board for the
 * house the server prices on, and the card's line under each house.
 *
 * Found on review of the "any house on the feed" change (19 Oct 2026):
 *
 *   - a tap made before GET /settings/bullion answered sent requestedNames: []
 *     and wiped the shop's requested names; and the GET landing after the
 *     tap moved the tick back to the old house while the server priced on
 *     the new one;
 *   - two quick taps that both failed left the tick on the first, unsaved,
 *     house;
 *   - Home showed another house's live rates when the server's house was not
 *     on the live stream (it fell back to the phone's remembered house);
 *   - the card read "Not pricing yet — bhaw not published" for a house that
 *     publishes RTGS alone, although scans price its RTGS off its board.
 *
 * The app's own files are loaded as it runs them (type stripping, resolve
 * hook as in goldRateFigures.test.mjs).
 *
 * Run with:  node --test utils/__tests__/bullionChoice.test.mjs
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

const {
  bullionSaveBody,
  choiceOnFailed,
  choiceOnLoaded,
  choiceOnSaved,
  choiceOnTap,
  initialBullionChoice,
} = await import('@/utils/bullionChoice');
const { bullionCardNote } = await import('@/utils/bullionNames');
const { parseBhawPayload } = await import('@/utils/bhawPayload');
const { computeGoldRateFigures, goldRateBase, goldRateChanges, serverHouseVendor } = await import(
  '@/utils/goldRateFigures'
);

/**
 * The screen's handlers, as dashboard-matrices.tsx runs them, over a fake
 * store: `tick` is the house the phone follows (useBhawStore.provider).
 */
function screen(phoneHouse = '') {
  const s = { choice: initialBullionChoice(), tick: phoneHouse, popups: 0 };
  s.loaded = (selected) => {
    const { choice, follow } = choiceOnLoaded(s.choice, selected);
    s.choice = choice;
    if (follow) s.tick = follow;
  };
  s.tap = (key) => {
    const tapped = choiceOnTap(s.choice, s.tick);
    s.choice = tapped.choice;
    s.tick = key;
    return tapped.attempt;
  };
  s.saved = (attempt, selected) => {
    const { choice, follow } = choiceOnSaved(s.choice, attempt, selected);
    s.choice = choice;
    if (follow) s.tick = follow;
  };
  s.failed = (attempt) => {
    const { choice, revertTo } = choiceOnFailed(s.choice, attempt);
    s.choice = choice;
    if (revertTo === null) return;
    s.tick = revertTo;
    s.popups += 1;
  };
  return s;
}

// ---- 3. a tap before the list has loaded ------------------------------------

test('a tap before the list has loaded sends no requestedNames (the server keeps them); after, it sends the list', () => {
  for (const unknown of [undefined, null]) {
    const body = bullionSaveBody('kp_bullion', unknown);
    assert.deepEqual(body, { selected: 'kp_bullion' });
    assert.equal(Object.hasOwn(body, 'requestedNames'), false, 'left out, not []');
  }
  assert.deepEqual(bullionSaveBody('kp_bullion', []), { selected: 'kp_bullion', requestedNames: [] });
  const names = ['Gupta Jewellers'];
  const body = bullionSaveBody('kp_bullion', names);
  assert.deepEqual(body, { selected: 'kp_bullion', requestedNames: ['Gupta Jewellers'] });
  assert.notEqual(body.requestedNames, names, 'a copy');
});

test('the GET answering after a tap never moves the tick back; the save\'s answer sets it', () => {
  const s = screen('jmd_patil');
  const a = s.tap('kp_bullion');
  s.loaded('jmd_patil'); // the GET, sent before the tap, lands after it
  assert.equal(s.tick, 'kp_bullion', 'the tap stands');
  s.saved(a, 'kp_bullion');
  assert.equal(s.tick, 'kp_bullion');
  // Even after the save has answered, a GET that lands late is older.
  s.loaded('jmd_patil');
  assert.equal(s.tick, 'kp_bullion');
});

test('the GET before any tap sets the tick (the server\'s house over the phone\'s stamp)', () => {
  const s = screen('mega_bullion');
  s.loaded('smd_bullion');
  assert.equal(s.tick, 'smd_bullion');
});

test('a save\'s answer moves the tick to the house the server saved', () => {
  const s = screen('jmd_patil');
  s.loaded('jmd_patil');
  const a = s.tap('shree_ram');
  s.tick = 'jmd_patil'; // anything else moved it meanwhile (a late storage read)
  s.saved(a, 'shree_ram');
  assert.equal(s.tick, 'shree_ram');
});

// ---- 5. quick taps that fail -------------------------------------------------

test('two quick taps that both fail go back to the house the server confirmed, not the first unsaved tap', () => {
  const s = screen('jmd_patil');
  s.loaded('jmd_patil');
  const a = s.tap('kp_bullion');
  const b = s.tap('smd_bullion');
  s.failed(a);
  assert.equal(s.tick, 'smd_bullion', 'the earlier failure is not the latest tap\'s answer');
  s.failed(b);
  assert.equal(s.tick, 'jmd_patil', 'it used to land on kp_bullion, never saved');
  assert.equal(s.popups, 1);
});

test('a first tap saved and a second refused: back to the first, which the server has', () => {
  const s = screen('jmd_patil');
  s.loaded('jmd_patil');
  const a = s.tap('kp_bullion');
  const b = s.tap('smd_bullion');
  s.saved(a, 'kp_bullion');
  assert.equal(s.tick, 'smd_bullion', 'the later tap is still on its way');
  s.failed(b);
  assert.equal(s.tick, 'kp_bullion');
});

test('the earlier save\'s success landing after the latest tap failed moves the tick to it', () => {
  const s = screen('jmd_patil');
  s.loaded('jmd_patil');
  const a = s.tap('kp_bullion');
  const b = s.tap('smd_bullion');
  s.failed(b);
  assert.equal(s.tick, 'jmd_patil');
  s.saved(a, 'kp_bullion');
  assert.equal(s.tick, 'kp_bullion', 'the server prices on kp_bullion now');
});

test('an older save\'s late answer does not undo a newer confirmed one', () => {
  const s = screen('jmd_patil');
  s.loaded('jmd_patil');
  const a = s.tap('kp_bullion');
  const b = s.tap('smd_bullion');
  s.saved(b, 'smd_bullion');
  s.saved(a, 'kp_bullion');
  assert.equal(s.tick, 'smd_bullion');
  assert.equal(s.choice.confirmed, 'smd_bullion');
  const c = s.tap('kj_bullion');
  s.failed(c);
  assert.equal(s.tick, 'smd_bullion');
});

test('nothing confirmed yet: a failed tap goes back to the house shown before the first tap, then the GET settles it', () => {
  const s = screen('mega_bullion');
  const a = s.tap('kp_bullion');
  const b = s.tap('smd_bullion');
  s.failed(a);
  s.failed(b);
  assert.equal(s.tick, 'mega_bullion');
  s.loaded('shri_sai');
  assert.equal(s.tick, 'shri_sai', 'no tap pending: the server\'s record');
});

// ---- 4. Home: only the server's house's board --------------------------------

const LINE = 148452;
const board = (source, name, { cashSell = null, rtgsSell = null } = {}) => ({
  source,
  name,
  timestamp: '2026-10-19T11:14:43+0530',
  rows: [
    { label: 'Gold Future MCX', buy: String(LINE - 16), sell: String(LINE) },
    { label: '99.50 Gold Cash', buy: null, sell: cashSell === null ? null : String(cashSell) },
    { label: '99.50 Gold RTGS', buy: null, sell: rtgsSell === null ? null : String(rtgsSell) },
  ],
  cash_bhaw: cashSell === null ? null : cashSell - (LINE - 16),
  rtgs_bhaw: rtgsSell === null ? null : rtgsSell - (LINE - 16),
});
const VENDORS = parseBhawPayload([
  board('jmd_patil', 'JMD Patil', { cashSell: 148352, rtgsSell: 150652 }),
  board('smd_bullion', 'SMD Bullion', { rtgsSell: 150382 }),
  board('kj_bullion', 'KJ Bullion'),
  board('cash_house', 'Cash Only Bullion', { cashSell: 148000 }),
]);
const JMD = VENDORS.find((v) => v.source === 'jmd_patil');

const goldResponse = (key, name = key) => ({
  mcxLiveRate: 148400,
  rates: [],
  taxSettings: {
    mcxChangeBy: 0, rtgsChangeBy: 0, cashChangeBy: 0, rtgsTaxPercent: 0, rtgsVariant: 'taxed', pricingMcxLiveRate: LINE,
  },
  supremeChanges: { cashChange: -111, rtgsChange: 111 },
  ...(key === undefined ? {} : { bhawSource: { key, name, live: false } }),
});

test('Home: the server\'s house not on the live stream shows dashes, never the phone\'s house\'s rates', () => {
  // The phone remembers JMD Patil; the server prices on a house the live
  // stream does not carry this moment.
  assert.equal(serverHouseVendor('new_house', VENDORS, JMD), null);
  const gold = goldResponse('new_house', 'New House Bullion');
  const base = goldRateBase(gold, VENDORS, JMD);
  assert.deepEqual([base.cashLive, base.rtgsLive, base.houseLive], [false, false, false]);
  assert.equal(base.houseName, 'New House Bullion', 'named as the server named it, not "JMD Patil"');
  const figures = computeGoldRateFigures(base, goldRateChanges(gold));
  assert.equal(figures.retailFinal, null, 'a dash, not JMD\'s 1,48,352');
  assert.equal(figures.rtgsRate1, null, 'a dash, not JMD\'s 1,50,652');
  assert.equal(figures.rtgsSelected, null);
});

test('Home: the server\'s house on the live stream is the board, whatever the phone remembers', () => {
  assert.equal(serverHouseVendor('smd_bullion', VENDORS, JMD)?.source, 'smd_bullion');
  const gold = goldResponse('smd_bullion', 'SMD Bullion');
  const figures = computeGoldRateFigures(goldRateBase(gold, VENDORS, JMD), goldRateChanges(gold));
  assert.equal(figures.rtgsRate1, 150382);
  assert.equal(figures.retailFinal, null);
});

test('Home: the phone\'s house stands in only while the server has named none', () => {
  for (const key of [undefined, '', null]) {
    assert.equal(serverHouseVendor(key, VENDORS, JMD), JMD);
  }
  const gold = goldResponse(undefined);
  const figures = computeGoldRateFigures(goldRateBase(gold, VENDORS, JMD), goldRateChanges(gold));
  assert.equal(figures.rtgsRate1, 150652, 'JMD\'s own RTGS sell');
  assert.equal(figures.retailFinal, 148352);
});

// ---- 6. the card's line ---------------------------------------------------------

test('the card says how each side is priced: an RTGS-only house is not "Not pricing yet"', () => {
  const note = (key) => bullionCardNote(VENDORS.find((v) => v.source === key));
  assert.equal(note('smd_bullion'), 'RTGS live — Cash from the stored change');
  assert.equal(note('jmd_patil'), null, 'both sides its own: nothing to say');
  assert.equal(note('cash_house'), 'Cash live — RTGS from the stored change');
  assert.equal(note('kj_bullion'), 'Bhaw not published — Cash and RTGS from the stored change');
  assert.equal(bullionCardNote(null), 'Bhaw not published — Cash and RTGS from the stored change');
  for (const key of ['smd_bullion', 'jmd_patil', 'cash_house', 'kj_bullion']) {
    assert.doesNotMatch(String(note(key)), /Not pricing yet/);
  }
});

test('saves go one at a time in tap order; only the latest held tap is sent next', async () => {
  const { initialBullionSaveQueue, queueOnTap, queueOnSettled } = await import('../bullionChoice.ts');
  let q = initialBullionSaveQueue();
  // First tap goes at once.
  let r = queueOnTap(q, { key: 'new_house', attempt: 1 });
  assert.deepEqual(r.send, { key: 'new_house', attempt: 1 });
  q = r.queue;
  // Taps while it is out are held; a later one replaces an earlier one.
  r = queueOnTap(q, { key: 'smd_bullion', attempt: 2 });
  assert.equal(r.send, null);
  q = r.queue;
  r = queueOnTap(q, { key: 'kp_bullion', attempt: 3 });
  assert.equal(r.send, null);
  q = r.queue;
  // The first answers: only the latest held tap goes, so the server ends on it.
  r = queueOnSettled(q);
  assert.deepEqual(r.send, { key: 'kp_bullion', attempt: 3 });
  q = r.queue;
  // It answers too: nothing left, the next tap goes at once again.
  r = queueOnSettled(q);
  assert.equal(r.send, null);
  q = r.queue;
  assert.deepEqual(queueOnTap(q, { key: 'jmd_patil', attempt: 4 }).send, { key: 'jmd_patil', attempt: 4 });
});

// ---- JMD Patil unless the shop chose (22 Oct 2026) ----------------------------
//
// "by default jmd patil not selected some time select mega bullion": the
// phone followed the house it remembered ahead of the server's for good, and
// older builds remembered the two-house toggle's answer — Mega Bullion for
// every shop that never chose, while the toggle defaulted to off; with no
// house remembered, the toggle itself stood in for a server that named none.

test('the server\'s house wins over a remembered one as soon as it answers', async () => {
  const { phoneHouse } = await import('@/utils/bullionChoice');
  assert.equal(phoneHouse('mega_bullion', 'jmd_patil'), 'jmd_patil', 'it stayed on Mega Bullion');
  assert.equal(phoneHouse('', 'jmd_patil'), 'jmd_patil');
  // A house the shop chose is the server's answer too, Mega Bullion included.
  assert.equal(phoneHouse('jmd_patil', 'mega_bullion'), 'mega_bullion');
  assert.equal(phoneHouse('', 'smd_bullion'), 'smd_bullion');
});

test('until the server answers the remembered house stands in, and none is made up', async () => {
  const { phoneHouse } = await import('@/utils/bullionChoice');
  assert.equal(phoneHouse('smd_bullion', undefined), 'smd_bullion');
  assert.equal(phoneHouse('', undefined), '', 'no default to flash before the server says');
});

test('a server that names no house leaves JMD Patil; the older toggle is not read', async () => {
  const { DEFAULT_HOUSE, phoneHouse } = await import('@/utils/bullionChoice');
  assert.equal(DEFAULT_HOUSE, 'jmd_patil');
  assert.equal(phoneHouse('', null), 'jmd_patil', 'a toggle saved off made it Mega Bullion');
  assert.equal(phoneHouse('', ''), 'jmd_patil');
  assert.equal(phoneHouse('smd_bullion', null), 'smd_bullion');
});

test('the Home tile defaults read JMD Patil for the older toggle', async () => {
  const { DEFAULT_MATRIX_VALUES, withOpeningDefaults } = await import('@/constants/dashboardMatrices');
  assert.equal(DEFAULT_MATRIX_VALUES.bhaw_source_jmd, true);
  assert.equal(withOpeningDefaults({}).bhaw_source_jmd, true);
  assert.equal(withOpeningDefaults({ '22k_rtgs': true }).bhaw_source_jmd, true);
});
