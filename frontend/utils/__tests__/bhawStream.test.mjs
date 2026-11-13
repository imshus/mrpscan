/**
 * Pins how the live rate stream is read: SSE framing (utils/sseFrames.ts)
 * and snapshot parsing (utils/bhawPayload.ts).
 *
 * Both modules have no imports, so node loads the app's own files directly
 * (type stripping, Node 22.18+ / 24) — no mirrored copy to drift.
 *
 * Run with:  node --test utils/__tests__/bhawStream.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLastGoodKeeper,
  normalizeVendor,
  parseBhawPayload,
  premiumOverMcxSell,
  readBhawSnapshot,
} from '../bhawPayload.ts';
import { createSseFrameParser, isSnapshotEvent } from '../sseFrames.ts';

// The feed's bhaw is the side's sell less the MCX *buy* (the tracker's
// diff1/diff2): 148700 − 151900 = −3200, 156700 − 151900 = 4800. The premium
// over the MCX *sell* the app prices on is 50 lower: −3250 and 4750.
const SOURCE = {
  source: 'jmd_patil',
  name: 'JMD Patil',
  timestamp: '2026-10-06T17:50:22+0530',
  ok: true,
  error: null,
  rows: [
    { label: 'Gold Future MCX', buy: '151900', sell: '151950', high: null, low: null, note: null },
    { label: '99.50 Gold Cash', buy: null, sell: '148700', high: null, low: null, note: null },
    { label: '99.50 Gold RTGS', buy: null, sell: '156700', high: null, low: null, note: null },
  ],
  cash_bhaw: -3200,
  rtgs_bhaw: '4800',
};

/**
 * A house's record as the tracker builds it: each bhaw is that side's sell
 * less the MCX buy, and a side with no bhaw has no sell on its line.
 */
function house({
  source = 'jmd_patil',
  name = 'JMD Patil',
  mcxBuy = 151900,
  mcxSell = 151950,
  cashBhaw = -3200,
  rtgsBhaw = 4800,
} = {}) {
  const line = (label, sell) => ({ label, buy: null, sell: sell === null ? null : String(sell), high: null, low: null, note: null });
  return {
    ...SOURCE,
    source,
    name,
    rows: [
      { ...line('Gold Future MCX', mcxSell), buy: String(mcxBuy) },
      line('99.50 Gold Cash', cashBhaw === null ? null : mcxBuy + cashBhaw),
      line('99.50 Gold RTGS', rtgsBhaw === null ? null : mcxBuy + rtgsBhaw),
    ],
    cash_bhaw: cashBhaw,
    rtgs_bhaw: rtgsBhaw,
  };
}

// Three houses off one live frame (jmd.mrpscan.com/api/stream, 7 Oct 2026,
// 10:09:46), as sent: JMD prices Cash at MCX sell − 1200 and RTGS at
// + 2250, Shri Sai RTGS at + 2350 with no cash and a '-' buy, Mega only MCX.
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
    diff1: -1183,
    diff2: 2267,
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
      { label: '99.50 Gold Cash', buy: null, sell: null, high: null, low: null, note: 'customer template only' },
      { label: '99.50 Gold RTGS', buy: null, sell: null, high: null, low: null, note: 'customer template only' },
    ],
    diff1: null,
    diff2: null,
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
      { label: '99.50 Gold Cash', buy: null, sell: null, high: null, low: null, note: 'not published' },
      { label: '99.50 Gold RTGS', buy: '-', sell: '151820', high: '153600', low: '151758', note: 'no buy-back' },
    ],
    diff1: null,
    diff2: 2366,
    cash_bhaw: null,
    rtgs_bhaw: 2366,
    ok: true,
    error: null,
  },
];

test('frames: one event per blank line, data after "data: " kept as sent', () => {
  const parser = createSseFrameParser();
  const events = parser.push('data: [1]\n\ndata: [2]\n\n');
  assert.deepEqual(events, [
    { event: '', data: '[1]' },
    { event: '', data: '[2]' },
  ]);
});

test('frames: an event split across chunks, even mid-line, comes out once whole', () => {
  const parser = createSseFrameParser();
  assert.deepEqual(parser.push('da'), []);
  assert.deepEqual(parser.push('ta: {"a"'), []);
  assert.deepEqual(parser.push(':1}\n'), []);
  assert.deepEqual(parser.push('\n'), [{ event: '', data: '{"a":1}' }]);
});

test('frames: CRLF line endings are stripped', () => {
  const parser = createSseFrameParser();
  assert.deepEqual(parser.push('event: message\r\ndata: x\r\n\r\n'), [{ event: 'message', data: 'x' }]);
});

test('frames: multiple data lines join with \\n', () => {
  const parser = createSseFrameParser();
  assert.deepEqual(parser.push('data: a\ndata: b\ndata:c\n\n'), [{ event: '', data: 'a\nb\nc' }]);
});

test('frames: ": ping" comments and blank lines alone dispatch nothing', () => {
  const parser = createSseFrameParser();
  assert.deepEqual(parser.push(': ping\n\n\n: ping\n\n'), []);
});

test('frames: a heartbeat is a named event and is never a snapshot', () => {
  const parser = createSseFrameParser();
  const events = parser.push(
    ': ping\n\nevent: heartbeat\ndata: {"type":"heartbeat","at":"2026-10-06T17:50:42+0530"}\n\ndata: [3]\n\n',
  );
  assert.equal(events.length, 2);
  assert.equal(events[0].event, 'heartbeat');
  assert.equal(isSnapshotEvent(events[0]), false);
  assert.equal(isSnapshotEvent(events[1]), true);
  assert.equal(isSnapshotEvent({ event: 'message', data: '[]' }), true);
  // The event name does not leak into the next frame.
  assert.equal(events[1].event, '');
});

test('frames: id/retry fields are ignored, reset drops a half-received event', () => {
  const parser = createSseFrameParser();
  assert.deepEqual(parser.push('id: 7\nretry: 1000\ndata: y\n\n'), [{ event: '', data: 'y' }]);
  parser.push('event: heartbeat\ndata: half');
  parser.reset();
  assert.deepEqual(parser.push('\ndata: z\n\n'), [{ event: '', data: 'z' }]);
});

test('payload: a bare array of sources is read, figures coerced from strings', () => {
  const vendors = parseBhawPayload(JSON.stringify([SOURCE]));
  assert.equal(vendors.length, 1);
  const [v] = vendors;
  assert.equal(v.source, 'jmd_patil');
  assert.equal(v.name, 'JMD Patil');
  // The premium over the MCX sell, off the board lines...
  assert.equal(v.cashBhaw, -3250);
  assert.equal(v.rtgsBhaw, 4750);
  // ...and the feed's own figure, the string coerced.
  assert.equal(v.boardCashBhaw, -3200);
  assert.equal(v.boardRtgsBhaw, 4800);
  assert.equal(v.updatedAt, SOURCE.timestamp);
  assert.deepEqual(v.rows[0], { label: 'Gold Future MCX', buy: 151900, sell: 151950 });
  assert.equal(v.rows[1].buy, null);
});

test('payload: the 3-minute shape {sources:[...]} is read the same way', () => {
  const snapshot = {
    fetched_at: '2026-10-06T17:50:22+0530',
    next_fetch_at: '2026-10-06T17:53:22+0530',
    errors: [],
    sources: [SOURCE],
  };
  assert.deepEqual(parseBhawPayload(JSON.stringify(snapshot)), parseBhawPayload([SOURCE]));
});

test('payload: sources with ok === false are dropped; null bhaw is kept as null', () => {
  const vendors = parseBhawPayload([
    { ...SOURCE, source: 'shri_sai', ok: false, error: 'timeout' },
    house({ source: 'mega_bullion', cashBhaw: null, rtgsBhaw: null }),
    { ...SOURCE, source: 'shri_ganesh', ok: undefined },
  ]);
  assert.deepEqual(
    vendors.map((v) => v.source),
    ['mega_bullion', 'shri_ganesh'],
  );
  assert.equal(vendors[0].cashBhaw, null);
  assert.equal(vendors[0].rtgsBhaw, null);
  assert.equal(vendors[0].boardCashBhaw, null);
  assert.equal(vendors[0].boardRtgsBhaw, null);
});

test('premium: each side is its sell less the MCX sell off the same board', () => {
  const [jmd, mega, sai] = parseBhawPayload(LIVE_FRAME);
  assert.deepEqual([jmd.cashBhaw, jmd.rtgsBhaw], [148271 - 149471, 151721 - 149471]);
  assert.deepEqual([jmd.cashBhaw, jmd.rtgsBhaw], [-1200, 2250]);
  // Shri Sai: RTGS only, its '-' buy-back on that line notwithstanding.
  assert.deepEqual([sai.cashBhaw, sai.rtgsBhaw], [null, 2350]);
  assert.deepEqual([mega.cashBhaw, mega.rtgsBhaw], [null, null]);
});

test('premium: the feed\'s own Badla Bhaw is kept as sent, beside it', () => {
  const [jmd, mega, sai] = parseBhawPayload(LIVE_FRAME);
  assert.deepEqual([jmd.boardCashBhaw, jmd.boardRtgsBhaw], [-1183, 2267]);
  assert.deepEqual([sai.boardCashBhaw, sai.boardRtgsBhaw], [null, 2366]);
  assert.deepEqual([mega.boardCashBhaw, mega.boardRtgsBhaw], [null, null]);
  // The two differ by exactly that board's MCX spread (sell − buy).
  assert.equal(jmd.boardCashBhaw - jmd.cashBhaw, 149471 - 149454);
  assert.equal(sai.boardRtgsBhaw - sai.rtgsBhaw, 149470 - 149454);
  // Strings, commas and signs read as the feed means them.
  const v = normalizeVendor(house({ cashBhaw: null, rtgsBhaw: null }));
  const raw = normalizeVendor({ ...SOURCE, rows: [], cash_bhaw: '-1,183', rtgs_bhaw: ' 2267 ' });
  assert.deepEqual([v.boardCashBhaw, raw.boardCashBhaw, raw.boardRtgsBhaw], [null, -1183, 2267]);
});

test('premium: MCX sell + premium is the house\'s sell whatever the MCX spread', () => {
  for (const [mcxBuy, mcxSell] of [[151900, 151950], [149454, 149471], [150000, 150000], [150010, 150000]]) {
    const v = normalizeVendor(house({ mcxBuy, mcxSell, cashBhaw: -1200, rtgsBhaw: 2250 }));
    // MCX sell + premium is the house's own sell, to the rupee.
    assert.equal(mcxSell + v.cashBhaw, mcxBuy - 1200);
    assert.equal(mcxSell + v.rtgsBhaw, mcxBuy + 2250);
    assert.equal(v.boardCashBhaw, -1200);
  }
});

test('premium: fallback order — lines, then bhaw less spread, then bhaw, then null', () => {
  // 1. Side sell and MCX sell: their difference, whatever the bhaw says.
  assert.equal(premiumOverMcxSell(148700, 151900, 151950, -3200), -3250);
  assert.equal(premiumOverMcxSell(148700, null, 151950, null), -3250);
  // 2. No side sell: the bhaw less the MCX spread — the same figure.
  assert.equal(premiumOverMcxSell(null, 151900, 151950, -3200), -3250);
  // 3. No MCX buy or no MCX sell either: the bhaw as given.
  assert.equal(premiumOverMcxSell(null, null, 151950, -3200), -3200);
  assert.equal(premiumOverMcxSell(148700, 151900, null, -3200), -3200);
  // 4. Nothing published: null, so pricing falls back.
  assert.equal(premiumOverMcxSell(null, 151900, 151950, null), null);
  assert.equal(premiumOverMcxSell(148700, 151900, null, null), null);

  // The same order off whole records.
  const mcxLine = SOURCE.rows[0];
  const noSideSell = { ...SOURCE, rows: [mcxLine, { label: '99.50 Gold Cash', buy: null, sell: '-' }] };
  assert.equal(normalizeVendor(noSideSell).cashBhaw, -3250, 'bhaw less the spread');
  assert.equal(normalizeVendor(noSideSell).rtgsBhaw, 4750, 'a side with no line at all too');

  const noMcxBuy = { ...noSideSell, rows: [{ ...mcxLine, buy: '-' }] };
  assert.equal(normalizeVendor(noMcxBuy).cashBhaw, -3200, 'no MCX buy: the bhaw as given');

  // An older feed, or a fixture, with the bhaw alone: taken as given.
  const bhawOnly = normalizeVendor({ source: 'jmd_patil', cash_bhaw: -3200, rtgs_bhaw: '4800' });
  assert.deepEqual([bhawOnly.cashBhaw, bhawOnly.rtgsBhaw], [-3200, 4800]);
  assert.deepEqual([bhawOnly.boardCashBhaw, bhawOnly.boardRtgsBhaw], [-3200, 4800]);

  // No MCX sell on the board but a side sell: never side sell less nothing.
  const noMcxSell = { ...SOURCE, rows: [{ ...mcxLine, sell: '' }, ...SOURCE.rows.slice(1)] };
  assert.deepEqual([normalizeVendor(noMcxSell).cashBhaw, normalizeVendor(noMcxSell).rtgsBhaw], [-3200, 4800]);
});

test('premium: "-", "", null and zero are no price; "1,48,700" is one', () => {
  const lines = (mcx, cash, rtgs) => [
    { label: 'Gold Future MCX', buy: mcx[0], sell: mcx[1] },
    { label: '99.50 Gold Cash', buy: null, sell: cash },
    { label: '99.50 Gold RTGS', buy: null, sell: rtgs },
  ];
  const read = (rows, cash_bhaw = null, rtgs_bhaw = null) =>
    normalizeVendor({ source: 'x', rows, cash_bhaw, rtgs_bhaw });

  const commas = read(lines(['1,51,900', '1,51,950'], '1,48,700', '1,56,700'), '-3,200', '4,800');
  assert.deepEqual([commas.cashBhaw, commas.rtgsBhaw], [-3250, 4750]);
  assert.deepEqual([commas.boardCashBhaw, commas.boardRtgsBhaw], [-3200, 4800]);

  // A blank price on either line leaves no premium (and no bhaw to fall
  // back on here), never a sell less nothing.
  for (const blank of ['-', '', ' ', null, '0', 0]) {
    const side = read(lines(['151900', '151950'], blank, blank));
    assert.deepEqual([side.cashBhaw, side.rtgsBhaw], [null, null], `side sell ${JSON.stringify(blank)}`);
    const mcx = read(lines([blank, blank], '148700', '156700'));
    assert.deepEqual([mcx.cashBhaw, mcx.rtgsBhaw], [null, null], `MCX ${JSON.stringify(blank)}`);
  }
  // A blank bhaw is no bhaw; a zero bhaw is a real one ("no premium").
  for (const blank of ['-', '', ' ', null, undefined]) {
    const bhaw = read(lines(['151900', '151950'], null, null), blank, blank);
    assert.deepEqual([bhaw.cashBhaw, bhaw.boardCashBhaw], [null, null], `bhaw ${JSON.stringify(blank)}`);
  }
  const zero = read(lines(['151900', '151950'], null, null), 0, '0');
  assert.deepEqual([zero.cashBhaw, zero.rtgsBhaw, zero.boardCashBhaw], [-50, -50, 0]);
});

test('payload: anything that is not a snapshot is ignored (null)', () => {
  assert.equal(parseBhawPayload('{"type":"heartbeat","at":"2026-10-06T17:50:42+0530"}'), null);
  assert.equal(parseBhawPayload('not json'), null);
  assert.equal(parseBhawPayload('42'), null);
  assert.equal(parseBhawPayload('null'), null);
  assert.equal(parseBhawPayload({ sources: 'nope' }), null);
  assert.equal(parseBhawPayload(JSON.stringify(SOURCE)), null);
});

test('payload: an empty or all-failed snapshot is an empty list, not null', () => {
  assert.deepEqual(parseBhawPayload('[]'), []);
  assert.deepEqual(parseBhawPayload([{ ...SOURCE, ok: false }]), []);
});

test('frames + payload: a stream fed byte by byte yields only the snapshots', () => {
  const stream =
    `data: ${JSON.stringify([SOURCE])}\r\n\r\n` +
    ': ping\r\n\r\n' +
    'event: heartbeat\r\ndata: {"type":"heartbeat","at":"x"}\r\n\r\n' +
    `data: ${JSON.stringify({ sources: [SOURCE] })}\r\n\r\n`;
  const parser = createSseFrameParser();
  const snapshots = [];
  for (const ch of stream) {
    for (const event of parser.push(ch)) {
      if (!isSnapshotEvent(event)) continue;
      const vendors = parseBhawPayload(event.data);
      if (vendors) snapshots.push(vendors);
    }
  }
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[1][0].source, 'jmd_patil');
});

test('snapshot: failed houses stay in the feed order with a null vendor', () => {
  const entries = readBhawSnapshot([
    { ...SOURCE, source: 'JMD_PATIL' },
    { ...SOURCE, source: 'Shri_Sai', ok: false, error: 'timeout' },
    { ok: false, error: 'no source at all' },
    { ...SOURCE, source: 'mega_bullion' },
  ]);
  assert.deepEqual(
    entries.map((e) => [e.source, e.vendor === null]),
    [
      ['jmd_patil', false],
      ['shri_sai', true],
      ['mega_bullion', false],
    ],
  );
  assert.equal(readBhawSnapshot('{"type":"heartbeat"}'), null);
  // parseBhawPayload is the same read with the failed houses left out.
  assert.deepEqual(
    parseBhawPayload([{ ...SOURCE, ok: false }, SOURCE]),
    readBhawSnapshot([SOURCE]).map((e) => e.vendor),
  );
});

test('keeper: a house that fails one round keeps its last good board, in place', () => {
  const keeper = createLastGoodKeeper(60_000);
  const jmd = house({ cashBhaw: -1356 });
  const sai = house({ source: 'shri_sai', name: 'Shri Sai', cashBhaw: -900 });
  const first = keeper.apply(readBhawSnapshot([jmd, sai]), 1_000);
  assert.deepEqual(first.map((v) => v.source), ['jmd_patil', 'shri_sai']);

  // JMD fails the next round: its last good board stands, first as before.
  const second = keeper.apply(
    readBhawSnapshot([{ ...jmd, ok: false }, house({ source: 'shri_sai', name: 'Shri Sai', cashBhaw: -901 })]),
    1_200,
  );
  assert.deepEqual(second.map((v) => [v.source, v.boardCashBhaw, v.cashBhaw]), [
    ['jmd_patil', -1356, -1406],
    ['shri_sai', -901, -951],
  ]);

  // Still failing past the hold: dropped, as a house with no good board is.
  const third = keeper.apply(readBhawSnapshot([{ ...jmd, ok: false }, sai]), 61_000);
  assert.deepEqual(third.map((v) => v.source), ['shri_sai']);

  // Back with a good board: that one is used.
  const fourth = keeper.apply(readBhawSnapshot([house({ cashBhaw: -1350 }), sai]), 61_500);
  assert.equal(fourth[0].boardCashBhaw, -1350);
  assert.equal(fourth[0].cashBhaw, -1400);
});

test('keeper: a house never seen good is left out; clear() forgets the boards', () => {
  const keeper = createLastGoodKeeper(60_000);
  assert.deepEqual(keeper.apply(readBhawSnapshot([{ ...SOURCE, ok: false }]), 0), []);
  keeper.apply(readBhawSnapshot([SOURCE]), 10);
  assert.equal(keeper.apply(readBhawSnapshot([{ ...SOURCE, ok: false }]), 20).length, 1);
  keeper.clear();
  assert.deepEqual(keeper.apply(readBhawSnapshot([{ ...SOURCE, ok: false }]), 30), []);
});
