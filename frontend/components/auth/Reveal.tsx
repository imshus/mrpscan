import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

interface RevealProps {
  /** Stagger slot — mockup `.reveal` delay is d × 60ms. */
  d?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Staggered entrance used on every mockup auth screen (`.reveal`):
 * fade in + rise 16px over 550ms with cubic-bezier(.16,.84,.44,1).
 */
export function Reveal({ d = 0, style, children }: RevealProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      d * 60,
      withTiming(1, { duration: 550, easing: Easing.bezier(0.16, 0.84, 0.44, 1) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 16 }],
  }));

  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
