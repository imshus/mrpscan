/**
 * Pins the scan processing screen's ring and caption (utils/processingRing.ts,
 * design mockup 6348f60): the count's even two seconds to 100 and its wait
 * there, the percent inside the ring, which message the pill shows at each
 * digit, how far the arc is drawn and where it ends, the glow's gradients
 * carrying the mockup's drop-shadow profile, and the caption cube's faces
 * landing where CSS's perspective puts them.
 *
 * Run with:  node --test utils/__tests__/processingRing.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PROC_CAPTIONS,
  PROC_COUNT_MS,
  PROC_CUBE_DEPTH,
  PROC_CUBE_PERSPECTIVE,
  PROC_CUBE_ROLL_MS,
  PROC_FINISH_SPEEDUP,
  PROC_GLOW_GRADIENT_RADIUS,
  PROC_GLOW_PROFILE,
  PROC_GLOW_REACH,
  PROC_GLOW_STROKE_STOPS,
  PROC_GLOW_TIP_STOPS,
  PROC_RING_CENTER,
  PROC_RING_CIRCUMFERENCE,
  PROC_RING_RADIUS,
  procArcEnd,
  procArcOffset,
  procCanLeave,
  procCaptionIndex,
  procCubeFace,
  procGlowOpacity,
  procGlowTipOpacity,
  procPercentAt,
  procPercentLabel,
} from '../processingRing.ts';

const close = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

test('the pill reads the mockup messages in order, with no numbers', () => {
  assert.deepEqual(PROC_CAPTIONS, [
    'Uploading Tags...',
    'Processing Tag Details...',
    'Calculating MRP...',
    'Loading Scanned Results...',
  ]);
  for (const caption of PROC_CAPTIONS) assert.doesNotMatch(caption, /\d|%/);
});

test('the count runs 0, 25, 50, 75, 100 at half-second steps, evenly', () => {
  assert.equal(PROC_COUNT_MS, 2000);
  assert.equal(procPercentAt(0), 0);
  assert.equal(procPercentAt(500), 25);
  assert.equal(procPercentAt(1000), 50);
  assert.equal(procPercentAt(1500), 75);
  assert.equal(procPercentAt(2000), 100);
  // Never ahead of the clock: the quarter before each step.
  assert.equal(procPercentAt(499), 0);
  assert.equal(procPercentAt(999), 25);
  assert.equal(procPercentAt(1999), 75);
  // Only the five steps, never the digits between them.
  const seen = new Set();
  let previous = 0;
  for (let ms = 0; ms <= 2500; ms += 1) {
    const value = procPercentAt(ms);
    seen.add(value);
    assert.ok(value >= previous && value - previous <= 25, `step at ${ms} ms`);
    previous = value;
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [0, 25, 50, 75, 100]);
  // Clamped: nothing before the start, 100 at most however long it takes.
  assert.equal(procPercentAt(-300), 0);
  assert.equal(procPercentAt(Number.NaN), 0);
  assert.equal(procPercentAt(6000), 100);
  assert.equal(procPercentAt(60_000), 100);
});

test('the count waits at 100 until the work is done, then the card opens', () => {
  assert.equal(procCanLeave(100, false), false);
  assert.equal(procCanLeave(99, true), false);
  assert.equal(procCanLeave(100, true), true);
  // Work not done: the count holds at 100.
  assert.equal(procPercentAt(2000, null), 100);
  assert.equal(procPercentAt(5000, null), 100);
  // Work done at or after 2 s changes nothing about the count.
  for (const readyAt of [2000, 6000]) {
    for (const ms of [0, 500, 1000, 1500, 1999, 2000, 4000]) {
      assert.equal(procPercentAt(ms, readyAt), procPercentAt(ms), `ready ${readyAt}, ${ms} ms`);
    }
  }
});

test('work done before the count does not hurry it: an even 0.5 s a quarter', () => {
  assert.equal(PROC_FINISH_SPEEDUP, 1);
  // Ready at 0.8 s: the count keeps its steps, 100 at 2 s.
  assert.equal(procPercentAt(800, 800), 25);
  assert.equal(procPercentAt(1000, 800), 50);
  assert.equal(procPercentAt(1999, 800), 75);
  assert.equal(procPercentAt(2000, 800), 100);
  for (let ms = 0; ms <= 2000; ms += 1) {
    assert.equal(procPercentAt(ms, 800), procPercentAt(ms), `same as the even count at ${ms} ms`);
  }
  // Already done when the screen opens: still the full even count.
  assert.equal(procPercentAt(500, 0), 25);
  assert.equal(procPercentAt(2000, 0), 100);
});

/** When a 16 ms ticker opens the card for work that is done at `readyAt`. */
function leavesAt(readyAt) {
  for (let ms = 0; ms < 20_000; ms += 16) {
    const ready = ms >= readyAt;
    if (procCanLeave(procPercentAt(ms, ready ? readyAt : null), ready)) return ms;
  }
  return null;
}

test('the card opens on 100: early work at 2 s, work at 2 s at 2 s, slow work when it lands', () => {
  assert.ok(Math.abs(leavesAt(800) - 2000) <= 16, `ready 0.8 s: ${leavesAt(800)}`);
  assert.ok(Math.abs(leavesAt(2000) - 2000) <= 16, `ready 2 s: ${leavesAt(2000)}`);
  assert.ok(Math.abs(leavesAt(6000) - 6000) <= 16, `ready 6 s: ${leavesAt(6000)}`);
});

test('the ring reads the count as a whole percent', () => {
  assert.equal(procPercentLabel(0), '0%');
  assert.equal(procPercentLabel(50), '50%');
  assert.equal(procPercentLabel(100), '100%');
  assert.equal(procPercentLabel(99.9), '99%');
  assert.equal(procPercentLabel(-4), '0%');
  assert.equal(procPercentLabel(Number.NaN), '0%');
  assert.equal(procPercentLabel(130), '100%');
});

test('the caption moves on each quarter, at 25, 50 and 75', () => {
  const at = (p) => PROC_CAPTIONS[procCaptionIndex(p)];
  assert.equal(at(0), 'Uploading Tags...');
  assert.equal(at(24), 'Uploading Tags...');
  assert.equal(at(25), 'Processing Tag Details...');
  assert.equal(at(49), 'Processing Tag Details...');
  assert.equal(at(50), 'Calculating MRP...');
  assert.equal(at(74), 'Calculating MRP...');
  assert.equal(at(75), 'Loading Scanned Results...');
  assert.equal(at(99), 'Loading Scanned Results...');
  assert.equal(at(100), 'Loading Scanned Results...');
  // Out of range or not a number: the nearest end, never undefined.
  assert.equal(at(-3), 'Uploading Tags...');
  assert.equal(at(Number.NaN), 'Uploading Tags...');
  assert.equal(at(140), 'Loading Scanned Results...');
  // Each message rolls in and lands inside its half-second quarter.
  assert.ok(PROC_CUBE_ROLL_MS < PROC_COUNT_MS / PROC_CAPTIONS.length);
});

test('the arc fills clockwise from nothing at 0 to the whole ring at 100', () => {
  assert.equal(procArcOffset(0), PROC_RING_CIRCUMFERENCE);
  assert.equal(procArcOffset(100), 0);
  close(procArcOffset(62), PROC_RING_CIRCUMFERENCE * 0.38, 1e-9, '62%');
  assert.equal(procArcOffset(-10), PROC_RING_CIRCUMFERENCE);
  assert.equal(procArcOffset(250), 0);
  assert.equal(procArcOffset(Number.NaN), PROC_RING_CIRCUMFERENCE);
  close(PROC_RING_CIRCUMFERENCE, 2 * Math.PI * PROC_RING_RADIUS, 0.01, 'circumference');
});

test("the arc's end walks clockwise from the path's start", () => {
  const at = (p) => procArcEnd(procArcOffset(p));
  const start = { x: PROC_RING_CENTER + PROC_RING_RADIUS, y: PROC_RING_CENTER };
  for (const [p, x, y] of [
    [0, start.x, start.y],
    [25, PROC_RING_CENTER, PROC_RING_CENTER + PROC_RING_RADIUS], // 3 o'clock once turned -90°
    [50, PROC_RING_CENTER - PROC_RING_RADIUS, PROC_RING_CENTER],
    [75, PROC_RING_CENTER, PROC_RING_CENTER - PROC_RING_RADIUS],
    [100, start.x, start.y],
  ]) {
    close(at(p).x, x, 1e-3, `x at ${p}%`);
    close(at(p).y, y, 1e-3, `y at ${p}%`);
  }
});

test('the glow fades in with a short arc, and the end discs share a closing gap', () => {
  assert.equal(procGlowOpacity(procArcOffset(0)), 0);
  let previous = 0;
  for (let p = 0.5; p <= 100; p += 0.5) {
    const value = procGlowOpacity(procArcOffset(p));
    assert.ok(value >= previous && value <= 1, `glow opacity at ${p}%`);
    previous = value;
  }
  assert.ok(procGlowOpacity(procArcOffset(15)) > 0.99);
  // Ends far apart: each disc at full strength; the gap closing: down to half.
  assert.equal(procGlowTipOpacity(procArcOffset(50)), 1);
  assert.equal(procGlowTipOpacity(procArcOffset(95)), 1);
  close(procGlowTipOpacity(procArcOffset(99)), 1 - 0.5 * (1 - 2.5133 / 12), 1e-3, '99%');
  assert.equal(procGlowTipOpacity(0), 0.5);
});

/** SVG stop interpolation: colour and opacity each linear, padded at the ends. */
function paintAt(stops, t) {
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const premult = (stop, other, k) => {
    const ca = rgb(stop.color);
    const cb = rgb(other.color);
    const a = stop.opacity + (other.opacity - stop.opacity) * k;
    return [0, 1, 2].map((c) => (ca[c] + (cb[c] - ca[c]) * k) * a).concat(a);
  };
  if (t <= stops[0].offset) return premult(stops[0], stops[0], 0);
  for (let i = 1; i < stops.length; i += 1) {
    if (t <= stops[i].offset) {
      const a = stops[i - 1];
      const b = stops[i];
      return premult(a, b, b.offset > a.offset ? (t - a.offset) / (b.offset - a.offset) : 1);
    }
  }
  const last = stops[stops.length - 1];
  return premult(last, last, 0);
}

function wellFormed(stops) {
  let previous = -1;
  for (const stop of stops) {
    assert.ok(stop.offset >= previous, 'offsets ascend');
    assert.ok(stop.offset >= 0 && stop.offset <= 1, 'offset within the gradient');
    assert.ok(stop.opacity >= 0 && stop.opacity <= 1, 'opacity within 0..1');
    assert.match(stop.color, /^#[0-9a-f]{6}$/);
    previous = stop.offset;
  }
}

test("the glow stroke's gradient is the mockup drop-shadow across the ring", () => {
  wellFormed(PROC_GLOW_STROKE_STOPS);
  const stops = PROC_GLOW_STROKE_STOPS;
  // Nothing at either edge of the stroke, so it has no border.
  assert.equal(stops[0].opacity, 0);
  assert.equal(stops[stops.length - 1].opacity, 0);
  close(stops[0].offset * PROC_GLOW_GRADIENT_RADIUS, PROC_RING_RADIUS - PROC_GLOW_REACH, 1e-4, 'inner edge');
  close(stops[stops.length - 1].offset, 1, 1e-9, 'outer edge');
  for (const [d, inside, outside] of PROC_GLOW_PROFILE.slice(0, -1)) {
    const gotIn = paintAt(stops, (PROC_RING_RADIUS - d) / PROC_GLOW_GRADIENT_RADIUS);
    const gotOut = paintAt(stops, (PROC_RING_RADIUS + d) / PROC_GLOW_GRADIENT_RADIUS);
    for (let c = 0; c < 4; c += 1) {
      close(gotIn[c], inside[c], 0.003, `inside ${d} channel ${c}`);
      close(gotOut[c], outside[c], 0.003, `outside ${d} channel ${c}`);
    }
  }
  // The glow is stronger on the ring's inside, as the blur gathers there.
  const [d] = PROC_GLOW_PROFILE[8];
  assert.ok(
    paintAt(stops, (PROC_RING_RADIUS - d) / PROC_GLOW_GRADIENT_RADIUS)[3] >
      paintAt(stops, (PROC_RING_RADIUS + d) / PROC_GLOW_GRADIENT_RADIUS)[3],
  );
});

test("an end disc's gradient carries the same fall-off round the arc's end", () => {
  wellFormed(PROC_GLOW_TIP_STOPS);
  const stops = PROC_GLOW_TIP_STOPS;
  assert.equal(stops[0].offset, 0);
  assert.equal(stops[stops.length - 1].offset, 1);
  assert.equal(stops[stops.length - 1].opacity, 0);
  for (const [d, inside, outside] of PROC_GLOW_PROFILE.slice(0, -1)) {
    const got = paintAt(stops, d / PROC_GLOW_REACH);
    for (let c = 0; c < 4; c += 1) {
      close(got[c], (inside[c] + outside[c]) / 2, 0.003, `disc ${d} channel ${c}`);
    }
  }
  // Flat under the arc's round cap.
  const centre = paintAt(stops, 0);
  const capEdge = paintAt(stops, PROC_GLOW_PROFILE[0][0] / PROC_GLOW_REACH);
  for (let c = 0; c < 4; c += 1) close(centre[c], capEdge[c], 1e-9, `cap channel ${c}`);
});

/** CSS: rotateX(angle) translateZ(19) seen through perspective 700. */
function cssProject(x, y, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  const Y = y * Math.cos(a) - PROC_CUBE_DEPTH * Math.sin(a);
  const Z = y * Math.sin(a) + PROC_CUBE_DEPTH * Math.cos(a);
  const k = PROC_CUBE_PERSPECTIVE / (PROC_CUBE_PERSPECTIVE - Z);
  return [x * k, Y * k];
}

/** React Native: [perspective, translateY, rotateX, scale], applied right to left. */
function rnProject(x, y, angleDeg) {
  const { translateY, scale } = procCubeFace(angleDeg);
  const a = (angleDeg * Math.PI) / 180;
  const sx = x * scale;
  const sy = y * scale;
  const Y = sy * Math.cos(a) + translateY;
  const Z = sy * Math.sin(a);
  const k = PROC_CUBE_PERSPECTIVE / (PROC_CUBE_PERSPECTIVE - Z);
  return [sx * k, Y * k];
}

test('a caption face lands where the mockup cube puts it', () => {
  // Facing the viewer: 19 closer, so a touch larger (700 / 681).
  const front = procCubeFace(0);
  close(front.translateY, 0, 1e-12, 'front translateY');
  close(front.scale, 700 / 681, 1e-12, 'front scale');
  assert.equal(front.visible, true);
  // Rolled up and away, or waiting underneath: edge-on, hidden.
  close(procCubeFace(90).translateY, -19, 1e-9, 'top');
  close(procCubeFace(-90).translateY, 19, 1e-9, 'bottom');
  assert.equal(procCubeFace(90).visible, false);
  assert.equal(procCubeFace(-90).visible, false);
  assert.equal(procCubeFace(180).visible, false);
  // Corners of the 270 x 38 pill, mid-roll, against the CSS projection.
  for (const angle of [-80, -45, -10, 0, 10, 45, 80]) {
    for (const [x, y] of [[-135, -19], [135, -19], [-135, 19], [135, 19], [0, 0]]) {
      const [cx, cy] = cssProject(x, y, angle);
      const [rx, ry] = rnProject(x, y, angle);
      close(rx, cx, 1e-9, `x at ${angle}deg (${x}, ${y})`);
      close(ry, cy, 1e-9, `y at ${angle}deg (${x}, ${y})`);
    }
  }
});
