import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

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
      return photo?.uri ?? null;
    } catch {
      return null;
    }
  }, [ready]);

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
    <View style={StyleSheet.absoluteFill}>
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
