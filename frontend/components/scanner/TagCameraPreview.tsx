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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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
 */
async function cropToFrame(
  uri: string,
  photoWidth: number | undefined,
  photoHeight: number | undefined,
  viewSize: { width: number; height: number },
): Promise<string> {
  if (!photoWidth || !photoHeight || !viewSize.width || !viewSize.height) {
    return uri;
  }

  const scale = Math.max(viewSize.width / photoWidth, viewSize.height / photoHeight);
  if (!Number.isFinite(scale) || scale <= 0) return uri;

  const offsetX = (photoWidth * scale - viewSize.width) / 2;
  const offsetY = (photoHeight * scale - viewSize.height) / 2;

  const frameLeft = (viewSize.width - SCANNER_FRAME_WIDTH) / 2;
  const frameTop = viewSize.height / 2 - SCANNER_FRAME_HEIGHT * SCANNER_FRAME_VERTICAL_BIAS;

  const originX = clamp(Math.round((frameLeft + offsetX) / scale), 0, photoWidth - 1);
  const originY = clamp(Math.round((frameTop + offsetY) / scale), 0, photoHeight - 1);
  const width = clamp(Math.round(SCANNER_FRAME_WIDTH / scale), 1, photoWidth - originX);
  const height = clamp(Math.round(SCANNER_FRAME_HEIGHT / scale), 1, photoHeight - originY);

  try {
    const result = await manipulateAsync(uri, [{ crop: { originX, originY, width, height } }], {
      compress: 0.92,
      format: SaveFormat.JPEG,
    });
    return result.uri;
  } catch (error) {
    console.warn("Failed to crop capture to the scan frame, using full photo:", error);
    return uri;
  }
}

export type TagCameraPreviewRef = {
  takePicture: () => Promise<string | null>;
  isReady: () => boolean;
};

interface TagCameraPreviewProps {
  onPermissionChange?: (granted: boolean) => void;
}

export const TagCameraPreview = forwardRef<TagCameraPreviewRef, TagCameraPreviewProps>(function TagCameraPreview(
  { onPermissionChange },
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

  const takePicture = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current || !ready) {
      return null;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (!photo?.uri) return null;

      return await cropToFrame(photo.uri, photo.width, photo.height, viewSize);
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
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setReady(true)}
      />
      {!ready ? (
        <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-black/50">
          <ActivityIndicator size="large" color="#B8860B" />
        </View>
      ) : null}
    </View>
  );
});
