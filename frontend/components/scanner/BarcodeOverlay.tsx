import { useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { SCANNER_FRAME_HEIGHT } from '@/constants/scannerFrame';

/**
 * Mockup .cap-scanline / @keyframes capScan: a 2px white line with a red glow
 * sweeping top 6% -> 92% and back over 2s (ease-in-out, infinite) while
 * fading 0.4 -> 1 -> 0.4.
 */
export function BarcodeOverlay() {
  const sweep = useSharedValue(0);
  // The frame's height follows the screen's width now, so the sweep is
  // measured from the box it is drawn in.
  const boxHeight = useSharedValue(SCANNER_FRAME_HEIGHT);
  const handleLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) boxHeight.value = height;
  };

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [sweep]);

  const scanlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sweep.value, [0, 1], [0.4, 1]),
    transform: [
      {
        translateY: interpolate(
          sweep.value,
          [0, 1],
          [boxHeight.value * 0.06, boxHeight.value * 0.92],
        ),
      },
    ],
  }));

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <Animated.View style={[styles.scanline, scanlineStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    height: '100%',
    width: '100%',
  },
  scanline: {
    position: 'absolute',
    left: '4%',
    right: '4%',
    top: 0,
    height: 2,
    borderRadius: 2,
    backgroundColor: Colors.white,
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 4,
  },
});
