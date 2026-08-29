import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { SCANNER_FRAME_HEIGHT } from './ScannerScreenLayout';

/**
 * Mockup .cap-scanline / @keyframes capScan: a 2px brand-red glowing line
 * sweeping top 6% -> 92% and back over 2s (ease-in-out, infinite) while
 * fading 0.4 -> 1 -> 0.4.
 */
export function BarcodeOverlay() {
  const sweep = useSharedValue(0);

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
          [SCANNER_FRAME_HEIGHT * 0.06, SCANNER_FRAME_HEIGHT * 0.92],
        ),
      },
    ],
  }));

  return (
    <View style={styles.container}>
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
    backgroundColor: Colors.brand,
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 4,
  },
});
