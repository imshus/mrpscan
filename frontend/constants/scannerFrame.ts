/**
 * Capture frame geometry (mockup .cap-frame).
 *
 * Kept in its own module because both ScannerScreenLayout (which draws the
 * frame) and TagCameraPreview (which crops the photo down to it) need these,
 * and importing across those two components would be circular.
 */

/**
 * The frame spans the screen but for a narrow margin each side, in the
 * mockup's 1.6 shape, at the owner's asking (16 Oct 2026, from his design):
 * about 89% of the width, so a tag can be held close and fill it. Both the
 * frame drawn and the photo's cut come from this one rule, applied to the
 * same width (the camera view fills the screen), so the photo is cut to
 * exactly what the frame shows.
 */
export const SCANNER_FRAME_SIDE_MARGIN = 22;
export const SCANNER_FRAME_ASPECT = 1.6;
const MIN_FRAME_WIDTH = 240;
const MAX_FRAME_WIDTH = 440;

/** Before the screen is measured, and for overlays drawn outside the scanner. */
export const SCANNER_FRAME_WIDTH = 312;
export const SCANNER_FRAME_HEIGHT = 195;

export interface ScannerFrameSize {
  width: number;
  height: number;
}

/** The frame's size on a view `viewWidth` wide. */
export function scannerFrameSize(viewWidth: number): ScannerFrameSize {
  if (!(viewWidth > 0)) return { width: SCANNER_FRAME_WIDTH, height: SCANNER_FRAME_HEIGHT };
  const width = Math.round(
    Math.min(MAX_FRAME_WIDTH, Math.max(MIN_FRAME_WIDTH, viewWidth - 2 * SCANNER_FRAME_SIDE_MARGIN)),
  );
  return { width, height: Math.round(width / SCANNER_FRAME_ASPECT) };
}

/**
 * The captured side's thumbnail above the frame keeps the mockup's size: at
 * the frame's size it would run into the top bar on a shorter phone.
 */
export const SCANNER_THUMB_WIDTH = 240;
export const SCANNER_THUMB_HEIGHT = 150;

/** The frame's vertical placement: mockup transform translate(-50%, -60%). */
export const SCANNER_FRAME_VERTICAL_BIAS = 0.6;
