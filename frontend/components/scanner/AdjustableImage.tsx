import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export interface AdjustableImageRef {
  /**
   * Crops the source image down to whatever the user framed.
   * Returns null when the image was left untouched, so callers keep the
   * original file (and its prewarmed upload) in the common case.
   */
  exportAdjusted: () => Promise<string | null>;
}

interface AdjustableImageProps {
  uri: string;
  style?: object;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Captured-image viewer the user can drag and pinch to reframe the tag.
 * Uses PanResponder (no extra native dependency) and crops on export so the
 * adjustment reaches the OCR request, not just the preview.
 */
export const AdjustableImage = forwardRef<AdjustableImageRef, AdjustableImageProps>(
  function AdjustableImage({ uri, style }, ref) {
    const [box, setBox] = useState({ width: 0, height: 0 });
    const [natural, setNatural] = useState({ width: 0, height: 0 });

    // Animated values drive the view; the refs mirror them for gesture and crop math.
    const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const scaleValue = useRef(new Animated.Value(1)).current;
    const state = useRef({ tx: 0, ty: 0, scale: 1 });
    const gestureStart = useRef({ tx: 0, ty: 0, scale: 1, distance: 0 });

    const handleLayout = (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };

    if (natural.width === 0 && uri) {
      Image.getSize(
        uri,
        (width, height) => setNatural({ width, height }),
        () => setNatural({ width: 0, height: 0 }),
      );
    }

    // Keep the image from being dragged completely out of the frame.
    const applyTranslation = (nextTx: number, nextTy: number) => {
      const limitX = (box.width * (state.current.scale - 1)) / 2 + box.width * 0.25;
      const limitY = (box.height * (state.current.scale - 1)) / 2 + box.height * 0.25;
      state.current.tx = clamp(nextTx, -limitX, limitX);
      state.current.ty = clamp(nextTy, -limitY, limitY);
      translate.setValue({ x: state.current.tx, y: state.current.ty });
    };

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            gestureStart.current = {
              tx: state.current.tx,
              ty: state.current.ty,
              scale: state.current.scale,
              distance: 0,
            };
          },
          onPanResponderMove: (event, gesture) => {
            const touches = event.nativeEvent.touches;

            if (touches.length >= 2) {
              const [a, b] = touches;
              const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);

              if (gestureStart.current.distance === 0) {
                gestureStart.current.distance = distance;
                gestureStart.current.scale = state.current.scale;
                return;
              }

              const nextScale = clamp(
                (gestureStart.current.scale * distance) / gestureStart.current.distance,
                MIN_SCALE,
                MAX_SCALE,
              );
              state.current.scale = nextScale;
              scaleValue.setValue(nextScale);
              applyTranslation(state.current.tx, state.current.ty);
              return;
            }

            // A finger lifted mid-pinch: restart the pan from the current spot.
            if (gestureStart.current.distance !== 0) {
              gestureStart.current = {
                tx: state.current.tx,
                ty: state.current.ty,
                scale: state.current.scale,
                distance: 0,
              };
              return;
            }

            applyTranslation(
              gestureStart.current.tx + gesture.dx,
              gestureStart.current.ty + gesture.dy,
            );
          },
          onPanResponderRelease: () => {
            gestureStart.current.distance = 0;
          },
          onPanResponderTerminate: () => {
            gestureStart.current.distance = 0;
          },
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [box.width, box.height],
    );

    useImperativeHandle(ref, () => ({
      exportAdjusted: async () => {
        const { tx, ty, scale } = state.current;
        const untouched = scale === 1 && tx === 0 && ty === 0;
        if (untouched) return null;
        if (!box.width || !box.height || !natural.width || !natural.height) return null;

        // resizeMode="contain" fits the image inside the box before the user transform.
        const containScale = Math.min(box.width / natural.width, box.height / natural.height);
        const totalScale = containScale * scale;

        const originX = (-box.width / 2 - tx) / totalScale + natural.width / 2;
        const originY = (-box.height / 2 - ty) / totalScale + natural.height / 2;
        const cropWidth = box.width / totalScale;
        const cropHeight = box.height / totalScale;

        const x = clamp(Math.round(originX), 0, Math.max(0, natural.width - 1));
        const y = clamp(Math.round(originY), 0, Math.max(0, natural.height - 1));
        const width = clamp(Math.round(cropWidth), 1, natural.width - x);
        const height = clamp(Math.round(cropHeight), 1, natural.height - y);

        try {
          const result = await manipulateAsync(
            uri,
            [{ crop: { originX: x, originY: y, width, height } }],
            { compress: 0.92, format: SaveFormat.JPEG },
          );
          return result.uri;
        } catch (error) {
          console.warn('Failed to crop adjusted image, using original:', error);
          return null;
        }
      },
    }));

    return (
      <View style={[styles.box, style]} onLayout={handleLayout} {...panResponder.panHandlers}>
        <Animated.Image
          source={{ uri }}
          resizeMode="contain"
          style={[
            styles.image,
            {
              transform: [
                { translateX: translate.x },
                { translateY: translate.y },
                { scale: scaleValue },
              ],
            },
          ]}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
