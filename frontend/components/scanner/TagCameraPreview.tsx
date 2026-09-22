import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import {
  SCANNER_FRAME_HEIGHT,
  SCANNER_FRAME_VERTICAL_BIAS,
  SCANNER_FRAME_WIDTH,
} from '@/constants/scannerFrame';
import type { UprightImage } from '@/utils/tagCrop';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** EXIF orientations that turn the stored pixels a quarter, swapping width and height. */
const QUARTER_TURNS = new Set([5, 6, 7, 8]);

/**
 * Crops a captured photo down to the region the user framed on screen.
 *
 * CameraView fills the preview with a centre-crop of the sensor image, so the
 * mapping from view coordinates to photo pixels is the "cover" transform:
 * scale by max(viewW/photoW, viewH/photoH) and re-centre. The frame overlay is
 * positioned by ScannerScreenLayout as a SCANNER_FRAME_WIDTH x
 * SCANNER_FRAME_HEIGHT box, centred horizontally and sitting at
 * height/2 - SCANNER_FRAME_HEIGHT * 0.6, so we can recompute it here from the
 * measured preview size.
 *
 * Returns the original uri untouched if anything is unknown, so a capture can
 * never be lost to a bad crop.
 *
 * Alongside the framed uri comes the upright photo the crop was measured
 * against — uri and real pixel size — whenever that size proved trustworthy,
 * so the tag finder can cut from the same file without re-saving the whole
 * photo just to learn its size. Null when the size was never known or the
 * mapping did not describe this photo, and the finder makes its own copy.
 */
async function cropToFrame(
  uri: string,
  photoWidth: number | undefined,
  photoHeight: number | undefined,
  orientation: number | undefined,
  viewSize: { width: number; height: number },
): Promise<{ uri: string; upright: UprightImage | null }> {
  if (!viewSize.width || !viewSize.height) return { uri, upright: null };

  // The photo is saved exactly as the camera produced it, its rotation
  // carried in the EXIF tag rather than baked into the pixels: baking it in
  // was a decode and re-encode of the whole photo inside the shutter's own
  // wait. Every loader used here applies that tag on the way in, so the size
  // the framing is measured against is the size after the turn — a quarter
  // turn swaps the two.
  const turned = QUARTER_TURNS.has(orientation ?? 1);
  const storedWidth = photoWidth && photoWidth > 0 ? photoWidth : 0;
  const storedHeight = photoHeight && photoHeight > 0 ? photoHeight : 0;
  let source = turned
    ? { uri, width: storedHeight, height: storedWidth }
    : { uri, width: storedWidth, height: storedHeight };

  if (!source.width || !source.height) {
    // A file whose own tags do not say its size: re-saving it is the one way
    // left to learn it. Rare, and slow only on the phones that need it.
    try {
      const upright = await manipulateAsync(uri, [], { compress: 0.9, format: SaveFormat.JPEG });
      if (upright?.uri && upright.width && upright.height) {
        source = { uri: upright.uri, width: upright.width, height: upright.height };
      }
    } catch (error) {
      console.warn('Could not learn the capture size:', error);
    }
    if (!source.width || !source.height) return { uri, upright: null };
  }

  // The mapping below only holds while the photo stands the same way up as the
  // preview it was framed in. A photo that still lies the other way after the
  // tag is accounted for was taken with the phone held sideways, or carries
  // a tag that lies; measuring a portrait preview against those numbers puts
  // the crop somewhere else entirely — a blank corner of the card, and a scan
  // with no values on that phone while the same tag reads fine on the next.
  const previewIsPortrait = viewSize.height >= viewSize.width;

  if (previewIsPortrait !== (source.height >= source.width)) {
    // Saving the file again bakes the rotation into the pixels, after which
    // the reported size is the size the framing was done against. At 0.9
    // rather than lossless: everything cut from this copy is re-encoded at
    // 0.92 anyway, and a lossless save of a whole photo was seconds of the
    // shutter's wait on the phones that need it.
    try {
      const upright = await manipulateAsync(uri, [], { compress: 0.9, format: SaveFormat.JPEG });
      if (upright?.uri && upright.width && upright.height) {
        source = { uri: upright.uri, width: upright.width, height: upright.height };
      }
    } catch (error) {
      console.warn('Could not normalise the capture orientation:', error);
    }
  }

  if (previewIsPortrait !== (source.height >= source.width)) {
    // Still lying the other way: which quarter turn was applied is not
    // recoverable from here, so any crop would be a guess cut out of the wrong
    // place. The whole photo still carries the tag, and the reader magnifies
    // parts of whatever it is given.
    console.warn('Capture is sideways to the preview; sending the whole photo.');
    return { uri: source.uri, upright: null };
  }

  const scale = Math.max(viewSize.width / source.width, viewSize.height / source.height);
  if (!Number.isFinite(scale) || scale <= 0) return { uri: source.uri, upright: null };

  const offsetX = (source.width * scale - viewSize.width) / 2;
  const offsetY = (source.height * scale - viewSize.height) / 2;

  const frameLeft = (viewSize.width - SCANNER_FRAME_WIDTH) / 2;
  const frameTop = viewSize.height / 2 - SCANNER_FRAME_HEIGHT * SCANNER_FRAME_VERTICAL_BIAS;

  const originX = clamp(Math.round((frameLeft + offsetX) / scale), 0, source.width - 1);
  const originY = clamp(Math.round((frameTop + offsetY) / scale), 0, source.height - 1);
  const width = clamp(Math.round(SCANNER_FRAME_WIDTH / scale), 1, source.width - originX);
  const height = clamp(Math.round(SCANNER_FRAME_HEIGHT / scale), 1, source.height - originY);

  // A rectangle that no longer has the frame's shape was cut short by an edge,
  // which means the mapping did not describe this photo. Better a whole photo
  // than a slice of one.
  const framePlausible =
    Math.abs(width / height - SCANNER_FRAME_WIDTH / SCANNER_FRAME_HEIGHT) <
    (SCANNER_FRAME_WIDTH / SCANNER_FRAME_HEIGHT) * 0.15;
  if (!framePlausible) {
    console.warn('Framed region does not fit this photo; sending the whole photo.', {
      photo: `${source.width}x${source.height}`,
      view: `${Math.round(viewSize.width)}x${Math.round(viewSize.height)}`,
      crop: `${width}x${height}`,
    });
    return { uri: source.uri, upright: null };
  }

  try {
    const result = await manipulateAsync(
      source.uri,
      [{ crop: { originX, originY, width, height } }],
      { compress: 0.92, format: SaveFormat.JPEG },
    );
    return { uri: result.uri, upright: source };
  } catch (error) {
    console.warn('Failed to crop capture to the scan frame, using full photo:', error);
    return { uri: source.uri, upright: source };
  }
}

/**
 * One press of the shutter, both ways it can be used.
 *
 * `framed` is the photo cut to the on-screen frame — what the shop lined up,
 * and what a capture always used to be. `full` is the whole photo, kept so
 * the tag finder can look through it and cut to the tag itself; when the
 * finder has nothing to say, `framed` is what gets used.
 */
export type TagCapture = {
  framed: string;
  full: string;
  /**
   * The finder's small copy of `full`, already being made — it starts the
   * moment the photo exists, alongside the frame crop, so the finder's
   * upload can leave the instant the side is confirmed. Null when nothing
   * was started (the web fallback).
   */
  detection: Promise<string> | null;
  /**
   * `full` with its real pixel size, when the framing established one — the
   * finder cuts from it directly. Null means the finder must find out the
   * size for itself.
   */
  upright: UprightImage | null;
};

export type TagCameraPreviewRef = {
  takePicture: () => Promise<TagCapture | null>;
  isReady: () => boolean;
};

interface TagCameraPreviewProps {
  onPermissionChange?: (granted: boolean) => void;
  /**
   * Unmounts the camera while another activity (the gallery picker) is up.
   * CameraView's `active` prop is iOS-only, so on Android releasing the
   * camera means not rendering it.
   */
  paused?: boolean;
}

export const TagCameraPreview = forwardRef<TagCameraPreviewRef, TagCameraPreviewProps>(function TagCameraPreview(
  { onPermissionChange, paused = false },
  ref,
) {
  const cameraRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!permission) return;
    onPermissionChange?.(permission.granted);
  }, [onPermissionChange, permission]);

  const takePicture = useCallback(async (): Promise<TagCapture | null> => {
    if (!cameraRef.current || !ready) {
      return null;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        // The camera's own JPEG, written as it is. Processing it meant
        // decoding and re-encoding the whole photo before the shutter
        // answered, only to turn it upright — which every loader here does
        // for itself from the EXIF tag, read below.
        skipProcessing: true,
        exif: true,
      });
      if (!photo?.uri) return null;

      const orientation = Number(photo.exif?.Orientation) || undefined;

      // No finder runs behind a camera capture (the shop's asking), so no
      // small copy is made for one: the capture is the framed photo alone.
      const { uri: framed, upright } = await cropToFrame(
        photo.uri,
        photo.width,
        photo.height,
        orientation,
        viewSize,
      );
      return { framed, full: upright?.uri ?? photo.uri, upright, detection: null };
    } catch {
      return null;
    }
  }, [ready, viewSize]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      takePicture,
      isReady: () => ready,
    }),
    [ready, takePicture],
  );

  if (Platform.OS === 'web') {
    return (
      <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-black">
        <Text className="px-6 text-center text-sm text-white/80">
          Camera preview is not available on web. Use capture or upload to select a tag photo.
        </Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-black">
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-black px-8">
        <Text className="mb-4 text-center text-base font-semibold text-white">
          Camera access is required to scan jewellery tags
        </Text>
        <Text className="mb-6 text-center text-sm text-white/70">
          Allow camera permission, or use Upload to pick a photo from your device.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="rounded-button bg-primary px-6 py-3 active:opacity-90"
        >
          <Text className="text-sm font-semibold text-white">Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} onLayout={handleLayout}>
      {paused ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B0906' }]} />
      ) : (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => setReady(true)}
        />
      )}
      {!ready && !paused ? (
        <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-black/50">
          <ActivityIndicator size="large" color="#B8860B" />
        </View>
      ) : null}
    </View>
  );
});
