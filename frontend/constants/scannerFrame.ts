/**
 * Capture frame geometry (mockup .cap-frame).
 *
 * Kept in its own module because both ScannerScreenLayout (which draws the
 * frame) and TagCameraPreview (which crops the photo down to it) need these,
 * and importing across those two components would be circular.
 */
// 30% larger than the mockup's 240 x 150, at the owner's asking (16 Oct
// 2026: 20%, then 10% more). Same 1.6 shape, so the photo is still cut to
// exactly this box.
export const SCANNER_FRAME_WIDTH = 312;
export const SCANNER_FRAME_HEIGHT = 195;

/**
 * The captured side's thumbnail above the frame keeps the mockup's size: at
 * the frame's new size it would run into the top bar on a shorter phone.
 */
export const SCANNER_THUMB_WIDTH = 240;
export const SCANNER_THUMB_HEIGHT = 150;

/** The frame's vertical placement: mockup transform translate(-50%, -60%). */
export const SCANNER_FRAME_VERTICAL_BIAS = 0.6;
