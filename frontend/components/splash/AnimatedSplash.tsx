import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { MrpScanTagLogo } from '@/components/splash/MrpScanTagLogo';
import { Colors } from '@/constants/theme';

/**
 * Native port of the design-mockup splash ("premium light reveal"):
 * gold reticle corners lock on, a red scan-line sweeps down revealing the
 * MRPscan tag card in sync, ground shadow + shimmer land, the reticle
 * settles, then the whole screen scales up and fades out.
 *
 * Timeline mirrors design-mockup/script.js playSplash():
 *   0ms reticle in · 250–1150ms scan/reveal · 300ms shadow · 1300ms shimmer
 *   1500ms reticle settle · 2300ms exit · 2700ms reveal content · 2800ms done
 */

const STAGE_W = 300;
const STAGE_H = 130;
const RETICLE_W = 300;
const RETICLE_H = 75;
const CARD_W = 270;
const CARD_H = (CARD_W * 100) / 555;
const SCANLINE_BLOCK_H = 21; // 18px red veil above + 3px line

const MOTE_POSITIONS: Array<[number, number]> = [
  [30, 68],
  [70, 62],
  [22, 40],
  [78, 45],
  [50, 78],
  [40, 30],
  [60, 82],
];

interface AnimatedSplashProps {
  /** Fired at 2700ms — start the underlying screen's slide-up entrance. */
  onReveal: () => void;
  /** Fired at 2800ms — splash fully faded, safe to unmount. */
  onFinish: () => void;
}

function Mote({ x, y, index }: { x: number; y: number; index: number }) {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withDelay(
      700 + index * 320,
      withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.ease) }), -1, false)
    );
  }, [drift, index]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(drift.value, [0, 0.2, 0.8, 1], [0, 0.7, 0.4, 0]),
    transform: [
      { translateY: interpolate(drift.value, [0, 1], [14, -46]) },
      { scale: interpolate(drift.value, [0, 1], [0.6, 1]) },
    ],
  }));

  return <Animated.View style={[styles.mote, { left: `${x}%`, top: `${y}%` }, style]} />;
}

export function AnimatedSplash({ onReveal, onFinish }: AnimatedSplashProps) {
  const reticleIn = useSharedValue(0);
  const glow = useSharedValue(0);
  const scan = useSharedValue(0);
  const shadowIn = useSharedValue(0);
  const float = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const settle = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    reticleIn.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.ease) });
    glow.value = withSequence(
      withTiming(1, { duration: 400, easing: Easing.ease }),
      withTiming(0.85, { duration: 1200, easing: Easing.ease })
    );
    scan.value = withDelay(
      250,
      withTiming(1, { duration: 900, easing: Easing.bezier(0.45, 0, 0.55, 1) })
    );
    shadowIn.value = withDelay(
      300,
      withTiming(1, { duration: 700, easing: Easing.bezier(0.3, 0.6, 0.3, 1) })
    );
    float.value = withDelay(
      1150,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }), -1, true)
    );
    shimmer.value = withDelay(
      1300,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
    );
    settle.value = withDelay(
      1500,
      withTiming(1, { duration: 450, easing: Easing.bezier(0.4, 0, 0.6, 1) })
    );
    exit.value = withDelay(
      2300,
      withTiming(1, { duration: 500, easing: Easing.bezier(0.4, 0, 0.6, 1) })
    );

    const revealTimer = setTimeout(onReveal, 2700);
    const finishTimer = setTimeout(onFinish, 2800);
    return () => {
      clearTimeout(revealTimer);
      clearTimeout(finishTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: 1 + 0.04 * exit.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  const reticleStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(reticleIn.value, [0, 1], [0, 0.8]) * interpolate(settle.value, [0, 1], [1, 0]),
    transform: [
      {
        scale:
          interpolate(reticleIn.value, [0, 1], [1.25, 1]) *
          interpolate(settle.value, [0, 1], [1, 0.88]),
      },
    ],
  }));

  // Same 250ms delay / 900ms duration / easing as the card reveal below,
  // so the line's position always matches the reveal edge.
  const scanlineStyle = useAnimatedStyle(() => ({
    top: interpolate(scan.value, [0, 1], [0.04, 0.96]) * RETICLE_H - (SCANLINE_BLOCK_H - 3),
    opacity: interpolate(scan.value, [0, 0.06, 0.94, 1], [0, 1, 1, 0]),
  }));

  const tiltStyle = useAnimatedStyle(() => {
    const rotateX = interpolate(scan.value, [0, 1], [16, 4]) - 2 * float.value;
    const rotateY = interpolate(scan.value, [0, 1], [-12, -9]) + 3 * float.value;
    return {
      transform: [
        { perspective: 1200 },
        { translateY: -3 * float.value },
        { rotateX: `${rotateX}deg` },
        { rotateY: `${rotateY}deg` },
        { scale: interpolate(scan.value, [0, 1], [0.93, 1]) },
      ],
    };
  });

  const revealStyle = useAnimatedStyle(() => ({
    height: scan.value * CARD_H,
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: shadowIn.value,
    transform: [{ scaleX: interpolate(shadowIn.value, [0, 1], [0.2, 1]) }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.25, 1], [0, 1, 0]),
    transform: [
      { translateX: interpolate(shimmer.value, [0, 1], [-CARD_W * 1.2, CARD_W * 1.2]) },
      { rotate: '6deg' },
    ],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} pointerEvents="auto">
      {/* Flat page ground — same as the screen it fades into, so no tone step. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.background }]} />

      {/* .splash-glow — soft red radial behind the logo */}
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="splashGlow" cx="50%" cy="46%" rx="60%" ry="60%">
              <Stop offset="0" stopColor="#D9291F" stopOpacity={0.1} />
              <Stop offset="0.58" stopColor="#D9291F" stopOpacity={0} />
              <Stop offset="1" stopColor="#D9291F" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#splashGlow)" />
        </Svg>
      </Animated.View>

      {/* .dust — drifting gold motes */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {MOTE_POSITIONS.map(([x, y], i) => (
          <Mote key={i} x={x} y={y} index={i} />
        ))}
      </View>

      <View style={styles.center}>
        <View style={styles.logoStage}>
          {/* .ground-shadow */}
          <Animated.View style={[styles.groundShadow, shadowStyle]}>
            <Svg width={150} height={20}>
              <Defs>
                <RadialGradient id="groundShadow" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0" stopColor="#15120D" stopOpacity={0.28} />
                  <Stop offset="0.72" stopColor="#15120D" stopOpacity={0} />
                  <Stop offset="1" stopColor="#15120D" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width={150} height={20} fill="url(#groundShadow)" />
            </Svg>
          </Animated.View>

          {/* .logo-card-wrap — 3D-tilted card, revealed top-down in sync with the scan-line */}
          <Animated.View style={[styles.cardAnchor, tiltStyle]}>
            <Animated.View style={[styles.revealWindow, revealStyle]}>
              <View style={styles.cardInner}>
                <MrpScanTagLogo width={CARD_W} />
              </View>
              {/* .card-shimmer */}
              <Animated.View style={[styles.shimmerStrip, shimmerStyle]}>
                <Svg width="100%" height="100%">
                  <Defs>
                    <LinearGradient id="cardShimmer" x1="0%" y1="0%" x2="100%" y2="0%">
                      <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                      <Stop offset="0.48" stopColor="#FFFFFF" stopOpacity={0.5} />
                      <Stop offset="0.51" stopColor="#FFFFFF" stopOpacity={0.65} />
                      <Stop offset="0.54" stopColor="#FFFFFF" stopOpacity={0.5} />
                      <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100%" height="100%" fill="url(#cardShimmer)" />
                </Svg>
              </Animated.View>
            </Animated.View>
          </Animated.View>

          {/* .reticle-lite — corners + scan-line paint above the card */}
          <Animated.View style={[styles.reticle, reticleStyle]} pointerEvents="none">
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={[styles.corner, styles.cornerBL]} />

            <Animated.View style={[styles.scanlineBlock, scanlineStyle]}>
              <Svg width="100%" height={SCANLINE_BLOCK_H}>
                <Defs>
                  <LinearGradient id="scanVeil" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0" stopColor="#D9291F" stopOpacity={0} />
                    <Stop offset="1" stopColor="#D9291F" stopOpacity={0.14} />
                  </LinearGradient>
                  <LinearGradient id="scanLine" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0" stopColor="#D9291F" stopOpacity={0} />
                    <Stop offset="0.15" stopColor="#D9291F" stopOpacity={1} />
                    <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={1} />
                    <Stop offset="0.85" stopColor="#D9291F" stopOpacity={1} />
                    <Stop offset="1" stopColor="#D9291F" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height={18} fill="url(#scanVeil)" />
                {/* soft red halo behind the line */}
                <Rect x="0" y={12} width="100%" height={9} rx={4.5} fill="url(#scanLine)" opacity={0.25} />
                <Rect x="0" y={18} width="100%" height={3} rx={1.5} fill="url(#scanLine)" />
              </Svg>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 100,
    elevation: 100,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoStage: {
    width: STAGE_W,
    height: STAGE_H,
  },
  groundShadow: {
    position: 'absolute',
    bottom: -6,
    left: (STAGE_W - 150) / 2,
    width: 150,
    height: 20,
  },
  cardAnchor: {
    position: 'absolute',
    top: (STAGE_H - CARD_H) / 2,
    left: (STAGE_W - CARD_W) / 2,
    width: CARD_W,
    shadowColor: '#15120D',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
  },
  revealWindow: {
    width: CARD_W,
    overflow: 'hidden',
  },
  cardInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CARD_W,
    height: CARD_H,
  },
  shimmerStrip: {
    position: 'absolute',
    top: -CARD_H * 0.2,
    left: 0,
    width: CARD_W * 0.55,
    height: CARD_H * 1.4,
  },
  reticle: {
    position: 'absolute',
    top: (STAGE_H - RETICLE_H) / 2,
    left: (STAGE_W - RETICLE_W) / 2,
    width: RETICLE_W,
    height: RETICLE_H,
  },
  corner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: '#A81F17',
    opacity: 0.8,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  scanlineBlock: {
    position: 'absolute',
    left: '2%',
    right: '2%',
    height: SCANLINE_BLOCK_H,
  },
  mote: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E85A4F',
  },
});
