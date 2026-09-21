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
 */
export async function uprightCopy(uri: string): Promise<UprightImage | null> {
  try {
    const result = await manipulateAsync(uri, [], { compress: 1, format: SaveFormat.JPEG });
    if (!result?.uri || !result.width || !result.height) return null;
    return { uri: result.uri, width: result.width, height: result.height };
  } catch (error) {
    console.warn('Could not make an upright copy of the photo:', error);
    return null;
  }
}

/** Below this share of the photo on either side, the "tag" is a speck or a slip. */
const MIN_BOX_FRACTION = 0.04;

/**
 * Cuts the tag the finder pointed at out of the upright photo.
 *
 * The box arrives as fractions of the image's own width and height, already
 * padded a little by the server so the print has air around it. Anything that
 * does not describe a real rectangle — off the edge, vanishingly small, a
 * crop that fails — answers null, and the caller keeps whatever it had.
 */
export async function cropToTagBox(image: UprightImage, box: TagBox): Promise<string | null> {
  const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
  const left = clamp01(box.x);
  const top = clamp01(box.y);
  const right = clamp01(box.x + box.width);
  const bottom = clamp01(box.y + box.height);
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
