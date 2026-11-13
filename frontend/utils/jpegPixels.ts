import jpeg from 'jpeg-js';

/**
 * The pixels of a JPEG handed over as base64, the one way the image
 * manipulator gives a photo's contents to JavaScript. Used on the small copy
 * the paper finder looks at (utils/paperCrop.ts), a few dozen kilobytes, so a
 * decoder in plain JavaScript is quick enough and needs no native module.
 *
 * RGBA, four bytes a pixel, row by row. Throws on anything that is not a
 * JPEG; the caller keeps the photo as it was.
 */
export function decodeJpegBase64(base64: string): { data: Uint8Array; width: number; height: number } {
  const image = jpeg.decode(base64ToBytes(base64), {
    useTArray: true, // Uint8Array, not Node's Buffer, which the phone does not have
    formatAsRGBA: true,
    maxResolutionInMP: 4,
    maxMemoryUsageInMB: 64,
  });
  return { data: image.data, width: image.width, height: image.height };
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUE = new Uint8Array(128).fill(255);
for (let i = 0; i < BASE64_ALPHABET.length; i++) BASE64_VALUE[BASE64_ALPHABET.charCodeAt(i)] = i;
BASE64_VALUE['-'.charCodeAt(0)] = 62; // the URL-safe alphabet, should a platform hand that over
BASE64_VALUE['_'.charCodeAt(0)] = 63;

/** Base64 (no line breaks, padding optional) to bytes. Throws on a stray character. */
export function base64ToBytes(base64: string): Uint8Array {
  let length = base64.length;
  while (length > 0 && base64.charCodeAt(length - 1) === 61 /* = */) length--;
  if (length % 4 === 1) throw new Error('Malformed base64');
  const out = new Uint8Array((length * 3) >> 2);
  const value = (i: number) => {
    const code = base64.charCodeAt(i);
    const v = code < 128 ? BASE64_VALUE[code] : 255;
    if (v === 255) throw new Error('Malformed base64');
    return v;
  };
  let o = 0;
  let i = 0;
  for (; i + 4 <= length; i += 4) {
    const n = (value(i) << 18) | (value(i + 1) << 12) | (value(i + 2) << 6) | value(i + 3);
    out[o++] = n >> 16;
    out[o++] = (n >> 8) & 255;
    out[o++] = n & 255;
  }
  if (length - i === 2) {
    out[o++] = (value(i) << 2) | (value(i + 1) >> 4);
  } else if (length - i === 3) {
    const n = (value(i) << 10) | (value(i + 1) << 4) | (value(i + 2) >> 2);
    out[o++] = n >> 8;
    out[o++] = n & 255;
  }
  return out;
}
