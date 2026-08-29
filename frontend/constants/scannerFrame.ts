/**
 * Capture frame geometry (mockup .cap-frame).
 *
 * Kept in its own module because both ScannerScreenLayout (which draws the
 * frame) and TagCameraPreview (which crops the photo down to it) need these,
 * and importing across those two components would be circular.
 */
export const SCANNER_FRAME_WIDTH = 240;
export const SCANNER_FRAME_HEIGHT = 150;

/** The frame's vertical placement: mockup transform translate(-50%, -60%). */
export const SCANNER_FRAME_VERTICAL_BIAS = 0.6;
