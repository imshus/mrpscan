/**
 * The numbers behind the scan processing screen (design mockup 6348f60:
 * `.proc-ring`, `.proc-arc`, `.proc-cube`): a thin ring that fills clockwise
 * as the scan progresses, glowing, and a glass pill under it whose caption
 * rolls like a cube to the next message. No percentage is shown.
 *
 * Pure, so node can test it; the functions marked 'worklet' also run inside
 * Reanimated's animated styles and props.
 */

/** The ring's SVG is a 96 box drawn at 230 dp (`.proc-spinner`). */
export const PROC_RING_SIZE = 230;
/**
 * In the mockup the SVG is inline, so it sits on the text baseline and
 * `.proc-ring` is taller by the font's descent (Inter at 16 px: 0.241 em):
 * the pill starts 52 below that, and the breathing glow is centred on it.
 */
export const PROC_RING_BASELINE_GAP = 3.9;
export const PROC_RING_VIEWBOX = 96;
export const PROC_RING_CENTER = 48;
export const PROC_RING_RADIUS = 40;
/** Track and arc stroke width, in viewBox units. */
export const PROC_RING_STROKE = 3.5;
/** The arc's stroke-dasharray, and its dash offset at 0% (2π × 40). */
export const PROC_RING_CIRCUMFERENCE = 251.33;
/** `.proc-arc { transition: stroke-dashoffset 0.12s linear }` */
export const PROC_ARC_TRANSITION_MS = 120;

/** The pill's messages, in the order the scan reaches them. */
export const PROC_CAPTIONS = [
  'Uploading Tags...',
  'Processing Tag Details...',
  'Calculating MRP...',
  'Loading Scanned Results...',
] as const;

/** The first progress digit of each caption (mockup procStageFor: < 25, < 55, < 85). */
export const PROC_CAPTION_FROM = [0, 25, 55, 85] as const;

const clampProgress = (progress: number): number => {
  'worklet';
  return Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
};

/** Which caption the pill shows at `progress` (0–100). */
export function procCaptionIndex(progress: number): number {
  'worklet';
  const value = clampProgress(progress);
  for (let i = PROC_CAPTION_FROM.length - 1; i > 0; i -= 1) {
    if (value >= PROC_CAPTION_FROM[i]) return i;
  }
  return 0;
}

/** The arc's stroke-dashoffset at `progress`: the full circumference at 0, none at 100. */
export function procArcOffset(progress: number): number {
  'worklet';
  return PROC_RING_CIRCUMFERENCE * (1 - clampProgress(progress) / 100);
}

// ---------------------------------------------------------------------------
// The arc's glow.
//
// The mockup glows the arc with
//   filter: drop-shadow(0 0 3px rgba(232,90,79,.95)) drop-shadow(0 0 9px rgba(217,41,31,.6))
// which Chrome applies in the SVG's own units (standard deviations of 3 and
// 9 viewBox units, i.e. 7.2 and 21.6 dp) and clips at the 230 dp box. Blur
// filters cannot be drawn on Android here (react-native-svg's runs through
// RenderScript per frame and caps the radius), so the glow is painted:
//  - along the arc, a wide butt-ended stroke on the arc's own path whose
//    paint is a radial gradient carrying the glow's fall-off across the ring;
//  - round each end, a disc carrying the same fall-off around the end,
//    masked to the side beyond the end so it meets the stroke without a seam.
//
// PROC_GLOW_PROFILE is the glow under the arc (both shadows, premultiplied
// rgba 0–1) at distance d from the ring's centre line, inside and outside
// the ring, worked out from the mockup's filter chain and checked against
// Chrome's render of the mockup.
// ---------------------------------------------------------------------------

type Rgba = readonly [number, number, number, number];

/** [distance from the centre line, inside the ring, outside the ring] */
export const PROC_GLOW_PROFILE: readonly (readonly [number, Rgba, Rgba])[] = [
  [1.75, [0.4096, 0.1438, 0.1245, 0.456], [0.3952, 0.1385, 0.1199, 0.44]],
  [2.25, [0.3834, 0.133, 0.1149, 0.4275], [0.366, 0.1267, 0.1094, 0.4081]],
  [2.75, [0.3534, 0.1205, 0.1039, 0.3947], [0.3337, 0.1136, 0.0979, 0.3728]],
  [3.25, [0.3212, 0.1073, 0.0922, 0.3596], [0.2999, 0.1, 0.0859, 0.3358]],
  [4, [0.2724, 0.0874, 0.0746, 0.3064], [0.2498, 0.08, 0.0683, 0.2811]],
  [4.75, [0.2269, 0.069, 0.0584, 0.2566], [0.2043, 0.0621, 0.0525, 0.2311]],
  [5.5, [0.1877, 0.0535, 0.0447, 0.2137], [0.1656, 0.0472, 0.0395, 0.1886]],
  [6.5, [0.147, 0.0378, 0.031, 0.1689], [0.1261, 0.0325, 0.0266, 0.1449]],
  [7.5, [0.1185, 0.0274, 0.0219, 0.1373], [0.0987, 0.0229, 0.0183, 0.1144]],
  [8.5, [0.0992, 0.021, 0.0164, 0.1157], [0.0803, 0.017, 0.0133, 0.0936]],
  [10, [0.0803, 0.0157, 0.012, 0.0941], [0.0623, 0.0122, 0.0094, 0.073]],
  [11.5, [0.0668, 0.0127, 0.0096, 0.0784], [0.0497, 0.0095, 0.0072, 0.0583]],
  [13, [0.0552, 0.0104, 0.0079, 0.0649], [0.0394, 0.0075, 0.0056, 0.0463]],
  [15, [0.0417, 0.0079, 0.006, 0.0489], [0.0281, 0.0053, 0.004, 0.033]],
  [17, [0.0301, 0.0057, 0.0043, 0.0354], [0.0191, 0.0036, 0.0027, 0.0225]],
  [19.5, [0.019, 0.0036, 0.0027, 0.0223], [0.0111, 0.0021, 0.0016, 0.0131]],
  [22, [0.0112, 0.0021, 0.0016, 0.0132], [0.006, 0.0011, 0.0009, 0.0071]],
  [25, [0.0055, 0.001, 0.0008, 0.0065], [0.0026, 0.0005, 0.0004, 0.0031]],
  [28, [0.0025, 0.0005, 0.0004, 0.0029], [0.001, 0.0002, 0.0001, 0.0012]],
];

/** How far the glow reaches from the arc (viewBox units): the stroke's half-width, the discs' radius. */
export const PROC_GLOW_REACH = 28;
/** The glow stroke's radial gradient radius (userSpaceOnUse, centred on the ring). */
export const PROC_GLOW_GRADIENT_RADIUS = PROC_RING_RADIUS + PROC_GLOW_REACH;

export type ProcGlowStop = { offset: number; color: string; opacity: number };

const hex2 = (unit: number) =>
  Math.max(0, Math.min(255, Math.round(unit * 255)))
    .toString(16)
    .padStart(2, '0');

/** A premultiplied paint as an SVG stop: colour and opacity apart. */
function toStop(offset: number, paint: Rgba, opacity = paint[3]): ProcGlowStop {
  const alpha = paint[3];
  const color =
    alpha > 0 ? `#${hex2(paint[0] / alpha)}${hex2(paint[1] / alpha)}${hex2(paint[2] / alpha)}` : '#000000';
  return {
    offset: Math.round(offset * 1e6) / 1e6,
    color,
    opacity: Math.round(Math.max(0, Math.min(1, opacity)) * 1e4) / 1e4,
  };
}

/**
 * The glow stroke's gradient: the inside profile from the stroke's inner
 * edge in to the arc, then the outside one out to its outer edge; nothing at
 * either edge, so the stroke has no visible border.
 */
export function procGlowStrokeStops(): ProcGlowStop[] {
  const R = PROC_RING_RADIUS;
  const g = PROC_GLOW_GRADIENT_RADIUS;
  const last = PROC_GLOW_PROFILE.length - 1;
  const stops: ProcGlowStop[] = [];
  for (let i = last; i >= 0; i -= 1) {
    const [d, inside] = PROC_GLOW_PROFILE[i];
    stops.push(toStop((R - d) / g, inside, i === last ? 0 : inside[3]));
  }
  for (let i = 0; i <= last; i += 1) {
    const [d, , outside] = PROC_GLOW_PROFILE[i];
    stops.push(toStop((R + d) / g, outside, i === last ? 0 : outside[3]));
  }
  return stops;
}

/**
 * An end disc's gradient (objectBoundingBox, centred, radius PROC_GLOW_REACH):
 * the mean of the inside and outside profiles by distance from the arc's
 * end, flat under the arc's round cap, nothing at the rim.
 */
export function procGlowTipStops(): ProcGlowStop[] {
  const last = PROC_GLOW_PROFILE.length - 1;
  const mean = (i: number): Rgba => {
    const [, a, b] = PROC_GLOW_PROFILE[i];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, (a[3] + b[3]) / 2];
  };
  const stops: ProcGlowStop[] = [toStop(0, mean(0))];
  for (let i = 0; i <= last; i += 1) {
    const paint = mean(i);
    stops.push(toStop(PROC_GLOW_PROFILE[i][0] / PROC_GLOW_REACH, paint, i === last ? 0 : paint[3]));
  }
  return stops;
}

export const PROC_GLOW_STROKE_STOPS: readonly ProcGlowStop[] = procGlowStrokeStops();
export const PROC_GLOW_TIP_STOPS: readonly ProcGlowStop[] = procGlowTipStops();

/** Arc length below which the whole glow fades with it, as a blur of a short arc does. */
export const PROC_GLOW_SHORT_ARC = 7;
/** Gap between the arc's ends below which the two end discs share it. */
export const PROC_GLOW_CLOSING_GAP = 12;

/**
 * The whole glow's opacity for the arc drawn at `arcOffset`: none for no
 * arc, rising over the first few units like a blurred short arc, then full.
 */
export function procGlowOpacity(arcOffset: number): number {
  'worklet';
  const length = Math.max(0, PROC_RING_CIRCUMFERENCE - arcOffset);
  return 1 - Math.exp(-length / PROC_GLOW_SHORT_ARC);
}

/**
 * Each end disc's opacity: full while the ends are apart, easing to half as
 * the gap closes, where the two discs overlap in the gap and together give
 * about one glow's worth.
 */
export function procGlowTipOpacity(arcOffset: number): number {
  'worklet';
  const gap = Math.max(0, arcOffset);
  return 1 - 0.5 * Math.max(0, 1 - gap / PROC_GLOW_CLOSING_GAP);
}

/**
 * Where the arc ends, in the ring's viewBox before its -90° turn: the path
 * starts at (88, 48) and runs clockwise.
 */
export function procArcEnd(arcOffset: number): { x: number; y: number } {
  'worklet';
  const length = Math.max(0, Math.min(PROC_RING_CIRCUMFERENCE, PROC_RING_CIRCUMFERENCE - arcOffset));
  const angle = (2 * Math.PI * length) / PROC_RING_CIRCUMFERENCE;
  return {
    x: PROC_RING_CENTER + PROC_RING_RADIUS * Math.cos(angle),
    y: PROC_RING_CENTER + PROC_RING_RADIUS * Math.sin(angle),
  };
}

// ---------------------------------------------------------------------------
// The rolling caption (`.proc-cube`): a 270 × 38 pill seen through
// perspective 700, its faces 19 out from the cube's axis; rolling to the next
// message turns the cube 90° about its horizontal axis over 550 ms
// (cubic-bezier(.65, 0, .35, 1)): the old message rolls up and away and the
// next one comes up from underneath.
// ---------------------------------------------------------------------------

export const PROC_CUBE_WIDTH = 270;
export const PROC_CUBE_HEIGHT = 38;
export const PROC_CUBE_MARGIN_TOP = 52;
export const PROC_CUBE_PERSPECTIVE = 700;
/** `translateZ(19px)`: half the pill's height. */
export const PROC_CUBE_DEPTH = 19;
export const PROC_CUBE_ROLL_MS = 550;
export const PROC_CUBE_EASING = [0.65, 0, 0.35, 1] as const;

/**
 * Where a face turned `angleDeg` about the cube's axis lands (0 = facing
 * the viewer, 90 = rolled up to the top, -90 = underneath), as the flat
 * transform React Native can draw: perspective, translateY, rotateX, scale.
 * The scale stands in for translateZ, which React Native lacks; with it the
 * projection is the CSS one exactly.
 */
export function procCubeFace(angleDeg: number): {
  translateY: number;
  scale: number;
  visible: boolean;
} {
  'worklet';
  const rad = (angleDeg * Math.PI) / 180;
  const scale = PROC_CUBE_PERSPECTIVE / (PROC_CUBE_PERSPECTIVE - PROC_CUBE_DEPTH * Math.cos(rad));
  return {
    translateY: -PROC_CUBE_DEPTH * Math.sin(rad) * scale,
    scale,
    visible: Math.abs(angleDeg) < 90,
  };
}
