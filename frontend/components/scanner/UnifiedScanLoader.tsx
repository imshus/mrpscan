import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Mask,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { Colors } from '@/constants/theme';
import {
  PROC_ARC_TRANSITION_MS,
  PROC_CAPTIONS,
  PROC_CUBE_EASING,
  PROC_CUBE_HEIGHT,
  PROC_CUBE_MARGIN_TOP,
  PROC_CUBE_PERSPECTIVE,
  PROC_CUBE_ROLL_MS,
  PROC_CUBE_WIDTH,
  PROC_GLOW_GRADIENT_RADIUS,
  PROC_GLOW_REACH,
  PROC_GLOW_STROKE_STOPS,
  PROC_GLOW_TIP_STOPS,
  PROC_RING_BASELINE_GAP,
  PROC_RING_CENTER,
  PROC_RING_CIRCUMFERENCE,
  PROC_RING_RADIUS,
  PROC_RING_SIZE,
  PROC_RING_STROKE,
  PROC_RING_VIEWBOX,
  procArcEnd,
  procArcOffset,
  procCaptionIndex,
  procCubeFace,
  procGlowOpacity,
  procGlowTipOpacity,
  procPercentLabel,
} from '@/utils/processingRing';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

type UnifiedScanLoaderProps = {
  /** The scan's progress, 0–100: fills the ring, reads inside it and picks the caption. */
  progress: number;
};

/** `.proc-ring::before`: a soft red disc 30 dp past the ring, breathing. */
const PULSE_SIZE = PROC_RING_SIZE + 60;
/** radial-gradient(circle, …) reaches the box's corner: half its diagonal. */
const PULSE_GRADIENT_RADIUS = (PULSE_SIZE / 2) * Math.SQRT2;
const DASH = [PROC_RING_CIRCUMFERENCE, PROC_RING_CIRCUMFERENCE];
/** Where the arc's path starts (3 o'clock in the viewBox, 12 o'clock once turned). */
const ARC_START_X = PROC_RING_CENTER + PROC_RING_RADIUS;
/** `.proc-cube-box { transition: transform … cubic-bezier(.65, 0, .35, 1) }`, 400 ms. */
const ROLL_TIMING = {
  duration: PROC_CUBE_ROLL_MS,
  easing: Easing.bezier(...PROC_CUBE_EASING),
};

/**
 * Mockup `.proc-center` (6348f60): a 230 dp ring that fills clockwise with
 * the scan's progress, glowing red, the percentage in its middle, with a
 * glass pill under it whose caption rolls like a cube to the next message.
 */
export function UnifiedScanLoader({ progress }: UnifiedScanLoaderProps) {
  const captionIndex = procCaptionIndex(progress);
  const percent = procPercentLabel(progress);

  return (
    <View style={styles.center}>
      <View style={styles.ring}>
        <RingPulse />
        <View style={styles.spinner}>
          <Svg
            style={StyleSheet.absoluteFill}
            width={PROC_RING_SIZE}
            height={PROC_RING_SIZE}
            viewBox={`0 0 ${PROC_RING_VIEWBOX} ${PROC_RING_VIEWBOX}`}
          >
            <Circle
              cx={PROC_RING_CENTER}
              cy={PROC_RING_CENTER}
              r={PROC_RING_RADIUS}
              fill="none"
              stroke="rgba(253,250,244,0.13)"
              strokeWidth={PROC_RING_STROKE}
            />
          </Svg>
          <RingArc progress={progress} />
        </View>
        {/* Outside the turned spinner, so the digits stay upright. */}
        <View pointerEvents="none" style={styles.percentBox}>
          <Text style={styles.percent} numberOfLines={1}>
            {percent}
          </Text>
        </View>
      </View>
      <RollingCaption index={captionIndex} />
    </View>
  );
}

/** opacity 0.55 → 1 → 0.55 over 2.4 s, ease-in-out (`@keyframes procGlow`). */
const RingPulse = memo(function RingPulse() {
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View pointerEvents="none" style={[styles.pulse, pulseStyle]}>
      <Svg width={PULSE_SIZE} height={PULSE_SIZE}>
        <Defs>
          <RadialGradient
            id="procPulse"
            cx={PULSE_SIZE / 2}
            cy={PULSE_SIZE / 2}
            r={PULSE_GRADIENT_RADIUS}
            fx={PULSE_SIZE / 2}
            fy={PULSE_SIZE / 2}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset={0} stopColor={Colors.brandLight} stopOpacity={0.2} />
            <Stop offset={0.45} stopColor={Colors.brandLight} stopOpacity={0.07} />
            <Stop offset={0.7} stopColor={Colors.brandLight} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={PULSE_SIZE / 2} cy={PULSE_SIZE / 2} r={PULSE_SIZE / 2} fill="url(#procPulse)" />
      </Svg>
    </Animated.View>
  );
});

/**
 * The red arc (`.proc-arc`), dash offset easing to each new digit over
 * 120 ms linear, and its glow underneath. A progress that goes back (a new
 * run on the same screen) jumps there, as the mockup resets without the
 * transition.
 */
function RingArc({ progress }: { progress: number }) {
  const [initialOffset] = useState(() => procArcOffset(progress));
  const offset = useSharedValue(initialOffset);
  const lastProgress = useRef(progress);

  useEffect(() => {
    const target = procArcOffset(progress);
    if (progress < lastProgress.current) {
      cancelAnimation(offset);
      offset.value = target;
    } else {
      offset.value = withTiming(target, {
        duration: PROC_ARC_TRANSITION_MS,
        easing: Easing.linear,
      });
    }
    lastProgress.current = progress;
  }, [progress, offset]);

  return <RingArcSvg offset={offset} initialOffset={initialOffset} />;
}

/**
 * Drawn once; only the shared offset moves it. The arc, the glow stroke
 * along it and the mask that keeps the end discs off that stroke all share
 * the one dash offset.
 */
const RingArcSvg = memo(function RingArcSvg({
  offset,
  initialOffset,
}: {
  offset: SharedValue<number>;
  initialOffset: number;
}) {
  const dashProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  const glowProps = useAnimatedProps(() => ({ opacity: procGlowOpacity(offset.value) }));
  const startTipProps = useAnimatedProps(() => ({ opacity: procGlowTipOpacity(offset.value) }));
  const endTipProps = useAnimatedProps(() => {
    const end = procArcEnd(offset.value);
    return { cx: end.x, cy: end.y, opacity: procGlowTipOpacity(offset.value) };
  });
  const initialEnd = procArcEnd(initialOffset);

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={PROC_RING_SIZE}
      height={PROC_RING_SIZE}
      viewBox={`0 0 ${PROC_RING_VIEWBOX} ${PROC_RING_VIEWBOX}`}
    >
      <Defs>
        <RadialGradient
          id="procGlowStroke"
          cx={PROC_RING_CENTER}
          cy={PROC_RING_CENTER}
          r={PROC_GLOW_GRADIENT_RADIUS}
          fx={PROC_RING_CENTER}
          fy={PROC_RING_CENTER}
          gradientUnits="userSpaceOnUse"
        >
          {PROC_GLOW_STROKE_STOPS.map((stop, i) => (
            <Stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
          ))}
        </RadialGradient>
        <RadialGradient id="procGlowTip" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          {PROC_GLOW_TIP_STOPS.map((stop, i) => (
            <Stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
          ))}
        </RadialGradient>
        {/* White everywhere but along the arc: an end disc shows only past its end. */}
        <Mask
          id="procGlowBeyond"
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={PROC_RING_VIEWBOX}
          height={PROC_RING_VIEWBOX}
        >
          <Rect x={0} y={0} width={PROC_RING_VIEWBOX} height={PROC_RING_VIEWBOX} fill="#ffffff" />
          <AnimatedCircle
            cx={PROC_RING_CENTER}
            cy={PROC_RING_CENTER}
            r={PROC_RING_RADIUS}
            fill="none"
            stroke="#000000"
            strokeWidth={PROC_GLOW_REACH * 2 + 1}
            strokeDasharray={DASH}
            animatedProps={dashProps}
          />
        </Mask>
      </Defs>
      <AnimatedG opacity={procGlowOpacity(initialOffset)} animatedProps={glowProps}>
        <AnimatedCircle
          cx={PROC_RING_CENTER}
          cy={PROC_RING_CENTER}
          r={PROC_RING_RADIUS}
          fill="none"
          stroke="url(#procGlowStroke)"
          strokeWidth={PROC_GLOW_REACH * 2}
          strokeDasharray={DASH}
          animatedProps={dashProps}
        />
        <AnimatedCircle
          cx={ARC_START_X}
          cy={PROC_RING_CENTER}
          r={PROC_GLOW_REACH}
          fill="url(#procGlowTip)"
          mask="url(#procGlowBeyond)"
          opacity={procGlowTipOpacity(initialOffset)}
          animatedProps={startTipProps}
        />
        <AnimatedCircle
          cx={initialEnd.x}
          cy={initialEnd.y}
          r={PROC_GLOW_REACH}
          fill="url(#procGlowTip)"
          mask="url(#procGlowBeyond)"
          opacity={procGlowTipOpacity(initialOffset)}
          animatedProps={endTipProps}
        />
      </AnimatedG>
      <AnimatedCircle
        cx={PROC_RING_CENTER}
        cy={PROC_RING_CENTER}
        r={PROC_RING_RADIUS}
        fill="none"
        stroke={Colors.brandLight}
        strokeWidth={PROC_RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={DASH}
        animatedProps={dashProps}
      />
    </Svg>
  );
});

/**
 * The glass pill (`.proc-cube`). Each message has its own face; a roll turns
 * the shown face up and away while the next comes up from underneath. A
 * newer message arriving mid-roll takes the incoming face's place, and the
 * roll lands on it. Progress going back (a new run) shows its message at
 * once.
 */
const RollingCaption = memo(function RollingCaption({ index }: { index: number }) {
  const target = useSharedValue(index);
  const shown = useSharedValue(index);
  const next = useSharedValue(index);
  const roll = useSharedValue(0);
  const rolling = useSharedValue(false);

  useEffect(() => {
    target.value = index;
  }, [index, target]);

  useAnimatedReaction(
    () => target.value,
    (current, previous) => {
      if (previous === null || current === previous) return;
      if (current < previous) {
        cancelAnimation(roll);
        rolling.value = false;
        roll.value = 0;
        shown.value = current;
        next.value = current;
        return;
      }
      next.value = current;
      if (rolling.value || current === shown.value) return;
      rolling.value = true;
      roll.value = withTiming(1, ROLL_TIMING, (finished) => {
        'worklet';
        if (!finished) return;
        shown.value = next.value;
        roll.value = 0;
        rolling.value = false;
      });
    },
  );

  return (
    <View
      style={styles.cube}
      accessible
      accessibilityRole="text"
      accessibilityLabel={PROC_CAPTIONS[index]}
    >
      {PROC_CAPTIONS.map((caption, k) => (
        <CaptionFace
          key={caption}
          caption={caption}
          faceIndex={k}
          shown={shown}
          next={next}
          roll={roll}
          rolling={rolling}
        />
      ))}
    </View>
  );
});

function CaptionFace({
  caption,
  faceIndex,
  shown,
  next,
  roll,
  rolling,
}: {
  caption: string;
  faceIndex: number;
  shown: SharedValue<number>;
  next: SharedValue<number>;
  roll: SharedValue<number>;
  rolling: SharedValue<boolean>;
}) {
  const faceStyle = useAnimatedStyle(() => {
    let angle = 180;
    if (faceIndex === shown.value) angle = 90 * roll.value;
    else if (rolling.value && faceIndex === next.value) angle = 90 * roll.value - 90;
    const face = procCubeFace(angle);
    return {
      opacity: face.visible ? 1 : 0,
      transform: [
        { perspective: PROC_CUBE_PERSPECTIVE },
        { translateY: face.translateY },
        { rotateX: `${angle}deg` },
        { scale: face.scale },
      ],
    };
  });

  return (
    <Animated.View style={[styles.face, faceStyle]}>
      <Svg style={StyleSheet.absoluteFill} width={PROC_CUBE_WIDTH} height={PROC_CUBE_HEIGHT}>
        <Defs>
          <LinearGradient id={`procFace${faceIndex}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={Colors.white} stopOpacity={0.1} />
            <Stop offset={1} stopColor={Colors.white} stopOpacity={0.04} />
          </LinearGradient>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={PROC_CUBE_WIDTH}
          height={PROC_CUBE_HEIGHT}
          rx={12}
          fill={`url(#procFace${faceIndex})`}
        />
        <Rect
          x={0.5}
          y={0.5}
          width={PROC_CUBE_WIDTH - 1}
          height={PROC_CUBE_HEIGHT - 1}
          rx={11.5}
          fill="none"
          stroke={Colors.white}
          strokeOpacity={0.16}
          strokeWidth={1}
        />
      </Svg>
      <Text style={styles.caption} numberOfLines={1}>
        {caption}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  ring: {
    width: PROC_RING_SIZE,
    height: PROC_RING_SIZE + PROC_RING_BASELINE_GAP,
  },
  pulse: {
    position: 'absolute',
    top: -30 + PROC_RING_BASELINE_GAP / 2,
    left: -30,
    width: PULSE_SIZE,
    height: PULSE_SIZE,
  },
  // `.proc-spinner { transform: rotate(-90deg) }`: the fill starts at 12 o'clock.
  spinner: {
    width: PROC_RING_SIZE,
    height: PROC_RING_SIZE,
    transform: [{ rotate: '-90deg' }],
  },
  // Over the ring's 230 dp square, centred on the ring.
  percentBox: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PROC_RING_SIZE,
    height: PROC_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mockup `.proc-percent { font-size: 3.4rem; font-weight: 800; color: #fff }`:
  // "100%" is about 135 dp wide, inside the ring's 183 dp clear middle.
  percent: {
    color: Colors.white,
    fontSize: 54.4,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  cube: {
    marginTop: PROC_CUBE_MARGIN_TOP,
    width: PROC_CUBE_WIDTH,
    height: PROC_CUBE_HEIGHT,
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    boxShadow: '0px 0px 18px -6px rgba(232, 90, 79, 0.5)',
    backfaceVisibility: 'hidden',
  },
  caption: {
    color: Colors.white,
    fontSize: 15.2,
    fontWeight: '700',
    letterSpacing: 0.152,
    textAlign: 'center',
  },
});
