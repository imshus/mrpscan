import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * The caret that blinks in the cell waiting for the next digit.
 *
 * Every code entry in the app draws its own cells and hides the real
 * caret (one invisible field overlays them all, so SMS autofill keeps
 * working), which left nothing on screen saying where typing would land.
 * This puts that back: the same bar a text field shows, in the active cell
 * only (owner, 28 Nov 2026).
 *
 * 530 ms a phase, the platform's own rate. It drives opacity on the native
 * thread, so it keeps blinking steadily while JS is busy, and the loop is
 * stopped when the cell stops being the active one.
 */
export function BlinkingCaret({ height = 20 }: { height?: number }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 530,
          easing: Easing.step0,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 530,
          easing: Easing.step0,
          useNativeDriver: true,
        }),
      ]),
    );
    blink.start();
    return () => {
      blink.stop();
      opacity.setValue(1);
    };
  }, [opacity]);

  return <Animated.View style={[styles.caret, { height, opacity }]} />;
}

const styles = StyleSheet.create({
  caret: {
    position: 'absolute',
    width: 2,
    borderRadius: 1,
    backgroundColor: Colors.primary,
  },
});
