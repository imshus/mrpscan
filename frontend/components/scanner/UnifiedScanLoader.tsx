import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { ScanStage } from '@/types/scanner';

type UnifiedScanLoaderProps = {
  progress: number;
  stage: ScanStage;
};

function stageMessage(stage: ScanStage): string {
  if (stage === ScanStage.Uploading) return 'Uploading Tags...';
  if (stage === ScanStage.AIProcessing) return 'Processing Tag Details...';
  if (stage === ScanStage.PreparingResults) return 'Loading Scanned Results...';
  return 'Finalizing...';
}

/**
 * Mockup `.proc-center` column: 96px spinner ring (`.proc-spinner`,
 * 1.1s linear infinite rotation), bold percent, stage label and sub text.
 */
export function UnifiedScanLoader({ progress, stage }: UnifiedScanLoaderProps) {
  const percent = Math.max(0, Math.min(100, Math.round(progress)));
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1100, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.center}>
      <Animated.View style={[styles.ring, spinStyle]}>
        <Svg width={96} height={96} viewBox="0 0 96 96">
          <Circle
            cx={48}
            cy={48}
            r={40}
            fill="none"
            stroke="rgba(253,250,244,0.15)"
            strokeWidth={5}
          />
          <Circle
            cx={48}
            cy={48}
            r={40}
            fill="none"
            stroke={Colors.brandLight}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray="130 400"
          />
        </Svg>
      </Animated.View>

      <Text style={styles.percent}>{percent}%</Text>
      <Text style={styles.stage}>{stageMessage(stage)}</Text>
      <Text style={styles.sub}>Please wait while the jewellery tag is being analysed.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  ring: {
    marginBottom: 18,
  },
  percent: {
    fontSize: 42,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
  },
  stage: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
  },
  sub: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(253,250,244,0.65)',
    textAlign: 'center',
  },
});
