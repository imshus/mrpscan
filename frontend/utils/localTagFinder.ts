import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

import type { TagBox } from '@/utils/scanApi';

/**
 * Finds the white tag in a photo on the phone itself, in well under a
 * second, with no model and no network.
 *
 * A jewellery tag is a small sheet of paper: the brightest sizeable, solid,
 * roughly rectangular thing in the photograph. That is enough to cut to it
 * at once, which is what the shop asked for — the adjustment they see should
 * not wait on a server. The model's finder still runs behind this one and
 * has the last word, because it knows a card from a bright cloth; this one
 * only knows brightness, and says nothing at all when the picture does not
 * clearly hold one such thing.
 */

/** Width of the copy the finder reads. A card's outline survives at this size; nothing else matters. */
const SAMPLE_WIDTH = 240;

/** A card smaller than this share of the photo is a speck (a tag at arm's length is a few percent); larger, a surface. */
const MIN_AREA_FRACTION = 0.01;
const MAX_AREA_FRACTION = 0.65;

/** Bright pixels beyond this share of the photo mean the background is bright too. */
const MAX_BRIGHT_FRACTION = 0.7;

/** A card fills its own rectangle; a bright sprawl does not. */
const MIN_FILL = 0.55;

/** Tags run from tall labels to wide strips, not to threads. */
const MIN_ASPECT = 0.3;
const MAX_ASPECT = 3.5;

/** Paper is bright in absolute terms, not merely brighter than the rest. */
const MIN_PAPER_LUMINANCE = 140;

/**
 * The tag's rectangle as fractions of the photo, or null when the photo does
 * not plainly contain one. `prior` is where the shop framed the tag, when
 * known: the finder then answers only with something inside that framing.
 */
export async function findTagLocally(uri: string, prior?: TagBox | null): Promise<TagBox | null> {
  try {
    const small = await manipulateAsync(uri, [{ resize: { width: SAMPLE_WIDTH } }], {
      compress: 0.6,
      format: SaveFormat.JPEG,
    });
    if (!small?.uri) return null;
    const bytes = await new File(small.uri).bytes();
    const image = decode(bytes, { useTArray: true, formatAsRGBA: false });
    if (!image?.data || !image.width || !image.height) return null;
    return boxAroundBrightCard(image.data, image.width, image.height, prior ?? null);
  } catch (error) {
    console.warn('On-device tag finder failed; leaving it to the model:', error);
    return null;
  }
}

/** Share of the smaller box that the two boxes have in common. */
export function boxAgreement(a: TagBox, b: TagBox): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

type Component = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
};

export function boxAroundBrightCard(
  data: Uint8Array,
  width: number,
  height: number,
  prior: TagBox | null,
): TagBox | null {
  const count = width * height;
  if (count === 0) return null;
  const channels = Math.max(1, Math.round(data.length / count));

  const luminance = new Uint8Array(count);
  const histogram = new Int32Array(256);
  for (let i = 0; i < count; i += 1) {
    const offset = i * channels;
    const value =
      channels >= 3
        ? (data[offset] * 77 + data[offset + 1] * 151 + data[offset + 2] * 28) >> 8
        : data[offset];
    luminance[i] = value;
    histogram[value] += 1;
  }

  const threshold = Math.max(otsuThreshold(histogram, count), MIN_PAPER_LUMINANCE);

  let bright = 0;
  for (let i = 0; i < count; i += 1) if (luminance[i] >= threshold) bright += 1;
  if (bright / count > MAX_BRIGHT_FRACTION || bright / count < MIN_AREA_FRACTION) return null;

  // Connected regions of bright pixels, four-way, with an explicit stack: a
  // few hundred thousand pixels at most, and no recursion to overflow.
  const label = new Int32Array(count);
  const stack = new Int32Array(count);
  const components: Component[] = [];
  for (let start = 0; start < count; start += 1) {
    if (luminance[start] < threshold || label[start] !== 0) continue;
    const id = components.length + 1;
    const component: Component = {
      minX: width,
      minY: height,
      maxX: -1,
      maxY: -1,
      area: 0,
    };
    let top = 0;
    stack[top] = start;
    top += 1;
    label[start] = id;
    while (top > 0) {
      top -= 1;
      const index = stack[top];
      const x = index % width;
      const y = (index - x) / width;
      component.area += 1;
      if (x < component.minX) component.minX = x;
      if (x > component.maxX) component.maxX = x;
      if (y < component.minY) component.minY = y;
      if (y > component.maxY) component.maxY = y;
      if (x > 0) top = visit(index - 1, id, luminance, threshold, label, stack, top);
      if (x < width - 1) top = visit(index + 1, id, luminance, threshold, label, stack, top);
      if (y > 0) top = visit(index - width, id, luminance, threshold, label, stack, top);
      if (y < height - 1) top = visit(index + width, id, luminance, threshold, label, stack, top);
    }
    components.push(component);
  }

  let best: TagBox | null = null;
  let bestScore = 0;
  for (const component of components) {
    const boxWidth = component.maxX - component.minX + 1;
    const boxHeight = component.maxY - component.minY + 1;
    const areaFraction = component.area / count;
    if (areaFraction < MIN_AREA_FRACTION || areaFraction > MAX_AREA_FRACTION) continue;
    if (component.area / (boxWidth * boxHeight) < MIN_FILL) continue;
    const aspect = boxWidth / boxHeight;
    if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) continue;

    const box: TagBox = {
      x: component.minX / width,
      y: component.minY / height,
      width: boxWidth / width,
      height: boxHeight / height,
    };
    // With a framing to go by, the card is the bright thing the shop lined
    // up, not the largest bright thing anywhere in the picture.
    const score = prior ? sharedArea(box, prior) : box.width * box.height;
    if (score > bestScore) {
      bestScore = score;
      best = box;
    }
  }
  return best;
}

function visit(
  index: number,
  id: number,
  luminance: Uint8Array,
  threshold: number,
  label: Int32Array,
  stack: Int32Array,
  top: number,
): number {
  if (label[index] !== 0 || luminance[index] < threshold) return top;
  label[index] = id;
  stack[top] = index;
  return top + 1;
}

function sharedArea(a: TagBox, b: TagBox): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

/** Otsu's split of a luminance histogram: the level that best separates two populations. */
function otsuThreshold(histogram: Int32Array, total: number): number {
  let sum = 0;
  for (let level = 0; level < 256; level += 1) sum += level * histogram[level];
  let sumBelow = 0;
  let countBelow = 0;
  let bestVariance = 0;
  let bestLevel = 128;
  for (let level = 0; level < 256; level += 1) {
    countBelow += histogram[level];
    if (countBelow === 0) continue;
    const countAbove = total - countBelow;
    if (countAbove === 0) break;
    sumBelow += level * histogram[level];
    const meanBelow = sumBelow / countBelow;
    const meanAbove = (sum - sumBelow) / countAbove;
    const variance = countBelow * countAbove * (meanBelow - meanAbove) * (meanBelow - meanAbove);
    if (variance > bestVariance) {
      bestVariance = variance;
      bestLevel = level;
    }
  }
  return bestLevel + 1;
}
