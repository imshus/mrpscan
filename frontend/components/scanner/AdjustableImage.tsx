import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// The photo is laid over the whole screen but the crop frame is small, so a
// tag that fills most of a photo has to shrink to sit inside it: zooming out
// below "covers the screen" is the normal case here, not an edge one.
const MIN_SCALE = 0.1;
const MAX_SCALE = 8;

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AdjustableImageRef {
  /**
   * Crops the source image down to what the crop window is showing.
   * Returns null only when the image's own size is not known yet, so callers
   * fall back to the file as it came.
   */
  exportAdjusted: () => Promise<string | null>;
  /** Scales the framing by `factor` about the centre; clamped to the pinch range. */
  zoomBy: (factor: number) => void;
  /**
   * Moves and scales the photo so this region of it — fractions of the
   * source's own width and height — sits in the crop window. Used to put the
   * tag the model found straight into the frame. Applied as soon as the
   * photo's size is known, so it can be called before it has loaded.
   */
  frameRegion: (region: CropRect) => void;
}

interface AdjustableImageProps {
  uri: string;
  style?: object;
  /**
   * The part of this view that is kept, in its own coordinates. The photo
   * fills the whole screen so the tag can be seen while it is moved; the
   * capture frame drawn over it is what is actually cut out. Defaults to the
   * whole view.
   */
  cropRect?: CropRect;
  /** Fires when a drag or pinch ends, so the caller can export the framing early. */
  onAdjustEnd?: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Captured-image viewer the user can drag and pinch to reframe the tag.
 * Uses PanResponder (no extra native dependency) and crops on export so the
 * adjustment reaches the OCR request, not just the preview.
 */
export const AdjustableImage = forwardRef<AdjustableImageRef, AdjustableImageProps>(
  function AdjustableImage({ uri, style, cropRect, onAdjustEnd }, ref) {
    const [box, setBox] = useState({ width: 0, height: 0 });
    const [natural, setNatural] = useState({ width: 0, height: 0 });

    // Animated values drive the view; the refs mirror them for gesture and crop math.
    const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const scaleValue = useRef(new Animated.Value(1)).current;
    const state = useRef({ tx: 0, ty: 0, scale: 1 });
    const gestureStart = useRef({ tx: 0, ty: 0, scale: 1, distance: 0 });
    // The responder is memoised on the box size; read the callback through a ref.
    const onAdjustEndRef = useRef(onAdjustEnd);
    onAdjustEndRef.current = onAdjustEnd;

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

    // Keep the image from being dragged completely out of the frame. The
    // allowance grows with a zoomed-in photo and never goes negative for a
    // zoomed-out one, which would have inverted the clamp.
    const applyTranslation = (nextTx: number, nextTy: number) => {
      const zoom = Math.max(state.current.scale, 1);
      const limitX = (box.width * (zoom - 1)) / 2 + box.width * 0.5;
      const limitY = (box.height * (zoom - 1)) / 2 + box.height * 0.5;
      state.current.tx = clamp(nextTx, -limitX, limitX);
      state.current.ty = clamp(nextTy, -limitY, limitY);
      translate.setValue({ x: state.current.tx, y: state.current.ty });
    };

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          // Claim both fingers before anything above or below can, and keep
          // them for the whole gesture: a pinch that loses one finger to a
          // parent view is a pinch that never scales.
          onStartShouldSetPanResponderCapture: () => true,
          onMoveShouldSetPanResponderCapture: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            userFramed.current = true;
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
            onAdjustEndRef.current?.();
          },
          onPanResponderTerminate: () => {
            gestureStart.current.distance = 0;
            onAdjustEndRef.current?.();
          },
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [box.width, box.height],
    );

    // The region to frame once the view and the photo have both been measured.
    const pendingRegion = useRef<CropRect | null>(null);
    // A drag or pinch means the framing is the user's now, not a default.
    const userFramed = useRef(false);

    const applyRegion = (region: CropRect): boolean => {
      if (!box.width || !box.height || !natural.width || !natural.height) return false;
      const window = cropRect ?? { x: 0, y: 0, width: box.width, height: box.height };
      const coverScale = Math.max(box.width / natural.width, box.height / natural.height);

      const regionWidth = Math.max(region.width * natural.width, 1);
      const regionHeight = Math.max(region.height * natural.height, 1);
      const wanted = Math.min(window.width / regionWidth, window.height / regionHeight);
      const nextScale = clamp(wanted / coverScale, MIN_SCALE, MAX_SCALE);
      const totalScale = coverScale * nextScale;

      const regionCenterX = (region.x + region.width / 2) * natural.width;
      const regionCenterY = (region.y + region.height / 2) * natural.height;
      const tx = window.x + window.width / 2 - box.width / 2
        - (regionCenterX - natural.width / 2) * totalScale;
      const ty = window.y + window.height / 2 - box.height / 2
        - (regionCenterY - natural.height / 2) * totalScale;

      state.current.scale = nextScale;
      scaleValue.setValue(nextScale);
      applyTranslation(tx, ty);
      return true;
    };

    useEffect(() => {
      if (!box.width || !box.height || !natural.width || !natural.height) return;
      const region = pendingRegion.current;
      if (region) {
        if (applyRegion(region)) pendingRegion.current = null;
        return;
      }
      if (userFramed.current) return;
      // Nothing has been framed yet: show the whole photo, so the piece and
      // its tag can be seen before either is moved.
      const cover = Math.max(box.width / natural.width, box.height / natural.height);
      const contain = Math.min(box.width / natural.width, box.height / natural.height);
      const start = clamp(contain / cover, MIN_SCALE, MAX_SCALE);
      state.current.scale = start;
      scaleValue.setValue(start);
      applyTranslation(0, 0);
      // applyRegion reads the measurements this effect waits for.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [box.width, box.height, natural.width, natural.height]);

    useImperativeHandle(ref, () => ({
      frameRegion: (region: CropRect) => {
        if (!applyRegion(region)) pendingRegion.current = region;
      },
      // Button-driven zoom: the same state the pinch writes, so export sees
      // one framing however it was reached. Re-clamping the translation keeps
      // the image inside the frame when zooming back out.
      zoomBy: (factor: number) => {
        state.current.scale = clamp(state.current.scale * factor, MIN_SCALE, MAX_SCALE);
        scaleValue.setValue(state.current.scale);
        applyTranslation(state.current.tx, state.current.ty);
      },
      exportAdjusted: async () => {
        const { tx, ty, scale } = state.current;
        if (!box.width || !box.height || !natural.width || !natural.height) return null;

        // resizeMode="cover" fills the view before the user transform, so what
        // is on screen is always a crop — even when nothing has been moved.
        const coverScale = Math.max(box.width / natural.width, box.height / natural.height);
        const totalScale = coverScale * scale;
        const window = cropRect ?? { x: 0, y: 0, width: box.width, height: box.height };

        // A point of the view maps back to the image through the same centre,
        // translation and scale the transform applied.
        const originX = (window.x - box.width / 2 - tx) / totalScale + natural.width / 2;
        const originY = (window.y - box.height / 2 - ty) / totalScale + natural.height / 2;
        const cropWidth = window.width / totalScale;
        const cropHeight = window.height / totalScale;

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
          resizeMode="cover"
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
