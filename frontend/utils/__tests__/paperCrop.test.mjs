/**
 * Pins the camera's cut from the red frame down to the paper tag
 * (utils/paperCrop.ts) and the JPEG decode that feeds it (utils/jpegPixels.ts):
 *
 *  - a tag held in fingers, on a white wall, or in a real phone photo is cut
 *    to its paper, and no printed figure is ever outside the cut;
 *  - a tag that already fills the frame, or a frame with no print in it, is
 *    not cut at all (null: the framed photo stands);
 *  - the same holds for the copy the phone really hands the finder: the
 *    framed photo halved once more to 160 px, and that copy through a full
 *    quality JPEG, base64 and decodeJpegBase64, as TagCameraPreview does;
 *  - paperCropRect rounds every edge outward and stays inside the photo;
 *  - decodeJpegBase64 gives plain RGBA bytes (no Node Buffer) for a JPEG
 *    from another encoder, and throws on anything else.
 *
 * The fixtures are frames from the finder's benchmark, taken down to 320 px
 * the way the phone's scaler does and posterized to 6 bits a channel to stay
 * small; TRUTH holds each one's printed-text box and paper box (fractions,
 * rounded outward) from that benchmark.
 *
 * Both modules load as they are (type stripping, Node 22.18+ / 24): paperCrop
 * has no imports, jpegPixels only jpeg-js.
 *
 * Run with:  node --test utils/__tests__/paperCrop.test.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { inflateSync } from 'node:zlib';

import jpeg from 'jpeg-js';

import { base64ToBytes, decodeJpegBase64 } from '../jpegPixels.ts';
import { findPaperBox, paperCropRect, paperFinderWidths } from '../paperCrop.ts';

const FIXTURES = new URL('./fixtures/papercrop/', import.meta.url);

/** Printed text and paper per fixture; null text = nothing printed. */
const TRUTH = {
  'grey-tag-fingers-320.png': {
    crop: true,
    text: { x0: 0.2775, y0: 0.2933, x1: 0.7042, y1: 0.7467 },
    paper: { x0: 0.2158, y0: 0.1773, x1: 0.825, y1: 0.824 },
  },
  'real-tag-phone-320.png': {
    crop: true,
    text: { x0: 0.2409, y0: 0.2484, x1: 0.8237, y1: 0.8073 },
    paper: { x0: 0.1872, y0: 0.1648, x1: 0.8337, y1: 0.8364 },
  },
  'wall-tag-320.png': {
    crop: true,
    text: { x0: 0.2458, y0: 0.276, x1: 0.7125, y1: 0.7387 },
    paper: { x0: 0.1941, y0: 0.1853, x1: 0.8059, y1: 0.816 },
  },
  'wall-tag-small-fingers-320.png': {
    crop: true,
    text: { x0: 0.3533, y0: 0.324, x1: 0.6467, y1: 0.732 },
    paper: { x0: 0.3091, y0: 0.24, x1: 0.7509, y1: 0.8 },
  },
  'tag-fills-frame-320.png': {
    crop: false,
    text: { x0: 0.1125, y0: 0.1346, x1: 0.8575, y1: 0.8894 },
  },
  'blank-wall-320.png': { crop: false, text: null },
};

/** A non-interlaced 8-bit RGB or RGBA PNG as RGBA bytes. */
function readPng(name) {
  const buf = readFileSync(new URL(name, FIXTURES));
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  for (let at = 8; at < buf.length; ) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('latin1', at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      assert.equal(body[8], 8, `${name}: 8-bit only`);
      assert.equal(body[12], 0, `${name}: not interlaced`);
      channels = { 2: 3, 6: 4 }[body[9]];
      assert.ok(channels, `${name}: RGB or RGBA only`);
    } else if (type === 'IDAT') idat.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const out = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? rows[out + x - channels] : 0;
      const b = y > 0 ? rows[out - stride + x] : 0;
      const c = x >= channels && y > 0 ? rows[out - stride + x - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      rows[out + x] = (raw[src + x] + predictor) & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += channels) {
    data[i * 4] = rows[j];
    data[i * 4 + 1] = rows[j + 1];
    data[i * 4 + 2] = rows[j + 2];
    data[i * 4 + 3] = channels === 4 ? rows[j + 3] : 255;
  }
  return { data, width, height };
}

/** Half size by 2x2 averages: the last step of the phone's halving chain. */
function halve({ data, width, height }) {
  const w = width >> 1;
  const h = height >> 1;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (2 * y * width + 2 * x) * 4;
      const q = p + width * 4;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        out[o + c] = (data[p + c] + data[p + 4 + c] + data[q + c] + data[q + 4 + c] + 2) >> 2;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

/** Through a full-quality JPEG and base64 and back, as the phone hands it over. */
function throughJpeg(image) {
  const encoded = jpeg.encode({ ...image, data: Buffer.from(image.data) }, 100);
  return decodeJpegBase64(Buffer.from(encoded.data).toString('base64'));
}

/** The inputs the finder may see for one fixture. */
function inputs(name) {
  const full = readPng(name);
  const half = halve(full);
  return [
    ['320 px', full],
    ['160 px', half],
    ['160 px JPEG', throughJpeg(half)],
  ];
}

const area = (b) => (b.x1 - b.x0) * (b.y1 - b.y0);
const holds = (outer, inner) =>
  outer.x0 <= inner.x0 && outer.y0 <= inner.y0 && outer.x1 >= inner.x1 && outer.y1 >= inner.y1;

test('fixtures stay small and 320 px wide', () => {
  for (const name of Object.keys(TRUTH)) {
    assert.ok(readFileSync(new URL(name, FIXTURES)).length < 60 * 1024, name);
    assert.equal(readPng(name).width, 320, name);
  }
});

for (const [name, truth] of Object.entries(TRUTH)) {
  if (!truth.crop) continue;
  test(`${name}: cut to the paper, every printed figure inside`, () => {
    for (const [label, image] of inputs(name)) {
      const box = findPaperBox(image.data, image.width, image.height);
      assert.ok(box, `${label}: a paper is found`);
      assert.ok(holds(box, truth.text), `${label}: no text outside ${JSON.stringify(box)}`);
      assert.ok(area(box) <= 0.9, `${label}: the cut is worth making`);
      assert.ok(area(box) <= 1.6 * area(truth.paper), `${label}: the cut sits close to the paper`);

      // On a full-size frame (a 12 MP photo's frame on a portrait phone)
      // the pixel cut still holds every figure.
      const width = 1640;
      const height = Math.round((1640 * image.height) / image.width);
      const rect = paperCropRect(box, width, height);
      assert.ok(rect, `${label}: a pixel cut`);
      const cut = {
        x0: rect.originX / width,
        y0: rect.originY / height,
        x1: (rect.originX + rect.width) / width,
        y1: (rect.originY + rect.height) / height,
      };
      assert.ok(holds(cut, truth.text), `${label}: no text outside the pixel cut`);
      assert.ok(rect.originX + rect.width <= width && rect.originY + rect.height <= height);
    }
  });
}

for (const [name, truth] of Object.entries(TRUTH)) {
  if (truth.crop) continue;
  test(`${name}: not cut`, () => {
    for (const [label, image] of inputs(name)) {
      assert.equal(findPaperBox(image.data, image.width, image.height), null, label);
    }
  });
}

test('findPaperBox refuses what it cannot read', () => {
  assert.equal(findPaperBox(new Uint8Array(30 * 20 * 4), 30, 20), null, 'too small');
  assert.equal(findPaperBox(new Uint8Array(10), 160, 100), null, 'short buffer');
  assert.equal(findPaperBox(new Uint8Array(160 * 100 * 4).fill(255), 160, 100), null, 'plain white');
});

test('paperCropRect rounds outward and stays inside the photo', () => {
  assert.deepEqual(paperCropRect({ x0: 0.1001, y0: 0.2, x1: 0.5004, y1: 0.7 }, 1000, 500), {
    originX: 100,
    originY: 100,
    width: 401,
    height: 250,
  });
  assert.deepEqual(paperCropRect({ x0: -0.1, y0: -0.2, x1: 1.2, y1: 0.5 }, 1000, 500), {
    originX: 0,
    originY: 0,
    width: 1000,
    height: 250,
  });
  assert.equal(paperCropRect({ x0: 0, y0: 0, x1: 1, y1: 1 }, 1000, 500), null, 'the whole photo');
  assert.equal(paperCropRect({ x0: 0.5, y0: 0.5, x1: 0.5005, y1: 0.9 }, 1000, 500), null, 'a sliver');
  assert.equal(paperCropRect({ x0: Number.NaN, y0: 0, x1: 0.5, y1: 0.5 }, 1000, 500), null);
  assert.equal(paperCropRect({ x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.5 }, 0, 500), null);
});

test('paperFinderWidths: one short step, then halvings, down to 160 px', () => {
  // a typical framed side: ~1690 px wide from a 12 MP phone
  assert.deepEqual(paperFinderWidths(1687), [1280, 640, 320, 160]);
  assert.deepEqual(paperFinderWidths(2560), [1280, 640, 320, 160]);
  assert.deepEqual(paperFinderWidths(2561), [2560, 1280, 640, 320, 160]);
  assert.deepEqual(paperFinderWidths(640), [320, 160]);
  assert.deepEqual(paperFinderWidths(321), [320, 160]);
  assert.deepEqual(paperFinderWidths(161), [160]);
  assert.deepEqual(paperFinderWidths(160), [], 'already the finder size: nothing worth cutting');
  assert.deepEqual(paperFinderWidths(0), []);
  assert.deepEqual(paperFinderWidths(Number.NaN), []);
  // no step shrinks by more than half, so thin print survives every one
  for (const width of [161, 300, 999, 1687, 4032, 8160]) {
    let from = width;
    for (const to of paperFinderWidths(width)) {
      assert.ok(to < from && to * 2 >= from, `${from} -> ${to}`);
      from = to;
    }
  }
});

test('base64ToBytes matches Node for every padding, and takes the URL-safe alphabet', () => {
  for (let length = 0; length < 40; length++) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 97 + length * 31) & 255);
    const b64 = Buffer.from(bytes).toString('base64');
    assert.deepEqual(base64ToBytes(b64), bytes, `padded, ${length} bytes`);
    assert.deepEqual(base64ToBytes(b64.replace(/=+$/, '')), bytes, `unpadded, ${length} bytes`);
    assert.deepEqual(base64ToBytes(Buffer.from(bytes).toString('base64url')), bytes, `url-safe, ${length} bytes`);
  }
  assert.throws(() => base64ToBytes('ab\ncd'), /Malformed base64/);
  assert.throws(() => base64ToBytes('abcde'), /Malformed base64/);
});

test('decodeJpegBase64 reads a tiny 4:2:0 JPEG into plain RGBA bytes', () => {
  // 16x8: red on the left half, blue on the right (written by Pillow at q95,
  // chroma halved both ways like Android's encoder).
  const base64 = readFileSync(new URL('tiny-16x8.jpg', FIXTURES)).toString('base64');
  const image = decodeJpegBase64(base64);
  assert.equal(image.width, 16);
  assert.equal(image.height, 8);
  assert.ok(image.data instanceof Uint8Array);
  assert.equal(Buffer.isBuffer(image.data), false, 'no Node Buffer: the phone has none');
  assert.equal(image.data.length, 16 * 8 * 4);
  const pixel = (x, y) => Array.from(image.data.subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 4));
  const near = (got, want) => want.every((v, i) => Math.abs(got[i] - v) <= 16);
  for (const y of [0, 4, 7]) {
    assert.ok(near(pixel(2, y), [220, 40, 40, 255]), `red at (2, ${y}): ${pixel(2, y)}`);
    assert.ok(near(pixel(13, y), [40, 60, 200, 255]), `blue at (13, ${y}): ${pixel(13, y)}`);
  }
});

test('decodeJpegBase64 throws on what is not a JPEG', () => {
  assert.throws(() => decodeJpegBase64(Buffer.from('not a jpeg at all').toString('base64')));
  assert.throws(() => decodeJpegBase64('***'));
});
