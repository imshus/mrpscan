import { useEffect, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useGoldRateTicker, type TickerRate } from '@/hooks/useGoldRateTicker';

/** Scroll speed: points per second. Slow enough to read a rate as it passes. */
const SPEED = 32;

function RateRun({ items, onLayout }: { items: TickerRate[]; onLayout?: (e: LayoutChangeEvent) => void }) {
  return (
    <View style={styles.run} onLayout={onLayout}>
      {items.map((item) => (
        <View key={item.key} style={styles.item}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>₹{item.value.toLocaleString('en-IN')}</Text>
          <Text style={styles.dot}>•</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The shop's gold rates scrolling across the top of the review card, at the
 * owner's asking: MCX, Retail, RTGS and every karat (per 10 g), the figures
 * Home shows. The run is drawn twice and slides left by one run's width, so
 * the loop has no seam. With "reduce motion" on it holds still and the
 * shop swipes it instead.
 */
export function GoldRateTicker() {
  const items = useGoldRateTicker();
  const [runWidth, setRunWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const x = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || runWidth <= 0) return;
    x.value = 0;
    x.value = withRepeat(
      withTiming(-runWidth, { duration: (runWidth / SPEED) * 1000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(x);
  }, [runWidth, reduceMotion, x]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  if (items.length === 0) return <View style={styles.box} />;

  if (reduceMotion) {
    return (
      <View style={styles.box}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <RateRun items={items} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.box} accessibilityLabel={items.map((i) => `${i.label} ${i.value}`).join(', ')}>
      <Animated.View style={[styles.track, slide]}>
        <RateRun
          items={items}
          onLayout={(event) => {
            const width = Math.ceil(event.nativeEvent.layout.width);
            if (width > 0 && width !== runWidth) setRunWidth(width);
          }}
        />
        <RateRun items={items} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  track: {
    flexDirection: 'row',
  },
  run: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginRight: 4,
  },
  value: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: Colors.brandDeep,
    fontVariant: ['tabular-nums'],
  },
  dot: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginHorizontal: 10,
  },
});
