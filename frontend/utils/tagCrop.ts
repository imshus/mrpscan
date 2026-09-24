import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type { TagBox } from '@/utils/scanApi';

/** A photo re-saved upright, with the size its pixels really have. */
export interface UprightImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Re-saves a photo so any rotation carried in its EXIF tag is baked into the
 * pixels, and returns the size the framing was actually done against.
 *
 * Plenty of Android cameras hand back the sensor's landscape frame with a tag
 * saying "turn this a quarter", and a gallery photo can carry anything. The
 * tag finder's answer is fractions of the image it was shown; cutting those
 * fractions out of a file that is secretly lying on its side lands the crop
 * in a blank corner. Finding and cutting on this one upright copy keeps the
 * two in agreement.
 *
 * Saved at 0.9 rather than lossless: the crop taken from it is re-encoded at
 * 0.92 regardless, so the extra bytes bought nothing and the encode of a
 * full-size gallery photo was a visible part of the wait.
 */
export async function uprightCopy(uri: string): Promise<UprightImage | null> {
  try {
    const result = await manipulateAsync(uri, [], { compress: 0.9, format: SaveFormat.JPEG });
    if (!result?.uri || !result.width || !result.height) return null;
    return { uri: result.uri, width: result.width, height: result.height };
  } catch (error) {
    console.warn('Could not make an upright copy of the photo:', error);
    return null;
  }
}

/**
 * Longest edge of the copy the finder is shown. Locating a label needs far
 * less than reading one: the upload path sends up to 2400px because the
 * reader magnifies digits. The server shows the model this copy at up to
 * 1024px in detail — a 512px thumbnail of a gallery photo left a small tag
 * a few dozen pixels across, and the box came back on the fingers holding it.
 */
const DETECTION_MAX_EDGE_PX = 1024;

/**
 * A small, fast copy of the photo for the finder to look at, made straight
 * from the original so it can be on its way before the full-size upright
 * copy exists. Both come out of the same loader, which applies the file's
 * rotation tag on the way in, so the finder's fractions — which do not
 * change with scale — land on the upright image exactly where it saw the
 * tag, and the cut is still made from the full-size one.
 *
 * Resized on its longest edge when the photo's size is known, so what goes
 * up is exactly what the server would make of it. Without a size it is
 * resized on width alone: a portrait photo comes out a little taller, which
 * costs a few kilobytes and nothing else, and spares a separate read of the
 * file just to pick an axis. Falls back to the original if the resize fails;
 * slower, never wrong.
 */
export async function detectionCopy(
  uri: string,
  size?: { width: number; height: number },
): Promise<string> {
  const resize =
    size && size.height > size.width
      ? { height: DETECTION_MAX_EDGE_PX }
      : { width: DETECTION_MAX_EDGE_PX };
  try {
    const result = await manipulateAsync(uri, [{ resize }], {
      compress: 0.7,
      format: SaveFormat.JPEG,
    });
    return result?.uri || uri;
  } catch (error) {
    console.warn('Could not make a detection copy; sending the full photo:', error);
    return uri;
  }
}

/** Below this share of the photo on either side, the "tag" is a speck or a slip. */
const MIN_BOX_FRACTION = 0.04;

/**
 * Extra room around the finder's box, as a share of the box's own size.
 *
 * A vision model places a box roughly, not to the pixel: its edges are
 * routinely off by a tenth of the box or more in one direction. Cut exactly
 * to its answer and that tenth is the top line of the tag — the diamond
 * weight, or the net weight — gone from the photo before the reader ever
 * sees it, which is exactly what happened on the shop's first try. Air
 * around a tag costs nothing, since the reader magnifies parts of whatever
 * it is given; a clipped line costs a field.
 */
const BOX_MARGIN = 0.15;

/**
 * Cuts the tag the finder pointed at out of the upright photo.
 *
 * The box arrives as fractions of the image's own width and height, already
 * padded a little by the server; it is widened again here by BOX_MARGIN of
 * its own size. Anything that does not describe a real rectangle — off the
 * edge, vanishingly small, a crop that fails — answers null, and the caller
 * keeps whatever it had.
 */
export async function cropToTagBox(image: UprightImage, box: TagBox): Promise<string | null> {
  const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
  const padX = box.width * BOX_MARGIN;
  const padY = box.height * BOX_MARGIN;
  const left = clamp01(box.x - padX);
  const top = clamp01(box.y - padY);
  const right = clamp01(box.x + box.width + padX);
  const bottom = clamp01(box.y + box.height + padY);
  if (right - left < MIN_BOX_FRACTION || bottom - top < MIN_BOX_FRACTION) return null;

  const originX = Math.round(left * image.width);
  const originY = Math.round(top * image.height);
  const width = Math.max(1, Math.min(Math.round((right - left) * image.width), image.width - originX));
  const height = Math.max(1, Math.min(Math.round((bottom - top) * image.height), image.height - originY));

  try {
    const result = await manipulateAsync(
      image.uri,
      [{ crop: { originX, originY, width, height } }],
      { compress: 0.92, format: SaveFormat.JPEG },
    );
    return result?.uri ?? null;
  } catch (error) {
    console.warn('Could not crop to the tag the finder pointed at:', error);
    return null;
  }
}

/**
 * The promise's answer, or null once `ms` have passed or it fails — never a
 * rejection. For a step that has a perfectly good fallback and must not turn
 * a tap into a stall.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}
