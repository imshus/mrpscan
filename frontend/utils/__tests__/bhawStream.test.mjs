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

import { parseBhawPayload } from '../bhawPayload.ts';
import { createSseFrameParser, isSnapshotEvent } from '../sseFrames.ts';

const SOURCE = {
  source: 'jmd_patil',
  name: 'JMD Patil',
  timestamp: '2026-10-06T17:50:22+0530',
  ok: true,
  error: null,
  rows: [
    { label: 'Gold Future MCX', buy: '151900', sell: '151950', high: null, low: null, note: null },
    { label: '99.50 Gold Cash', buy: null, sell: '148750', high: null, low: null, note: null },
    { label: '99.50 Gold RTGS', buy: null, sell: '156750', high: null, low: null, note: null },
  ],
  cash_bhaw: -3200,
  rtgs_bhaw: '4800',
};

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
  assert.equal(v.cashBhaw, -3200);
  assert.equal(v.rtgsBhaw, 4800);
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
    { ...SOURCE, source: 'mega_bullion', cash_bhaw: null, rtgs_bhaw: null },
    { ...SOURCE, source: 'shri_ganesh', ok: undefined },
  ]);
  assert.deepEqual(
    vendors.map((v) => v.source),
    ['mega_bullion', 'shri_ganesh'],
  );
  assert.equal(vendors[0].cashBhaw, null);
  assert.equal(vendors[0].rtgsBhaw, null);
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
