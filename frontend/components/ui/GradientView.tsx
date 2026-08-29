import { useId, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

interface GradientViewProps {
  /** Gradient stops, first → last (see Gradients in constants/theme). */
  colors: readonly string[];
  /** Matches the container's borderRadius so the fill is clipped correctly. */
  borderRadius?: number;
  /**
   * Diagonal white gloss overlay strength (mockup's `::before`
   * linear-gradient(120deg, rgba(255,255,255,S) → transparent 58%)).
   * Metallic champagne cards use 0.55, terracotta cards 0.16. Omit for none.
   */
  sheen?: number;
  /** 1px bright inner top edge (mockup's `inset 0 1px 0 rgba(255,255,255,…)`). */
  topHighlight?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Diagonal linear-gradient container built on react-native-svg —
 * stands in for the mockup's CSS linear-gradient(135–155deg, …) fills,
 * including the glossy sheen + inset top highlight its cards layer on top.
 *
 * The SVG is drawn at the container's measured pixel size (via onLayout)
 * rather than "100%": percentage-sized SVG surfaces don't reliably track
 * content-driven container heights on Android, which left gradient tiles
 * partially unfilled.
 */
export function GradientView({
  colors,
  borderRadius = 0,
  sheen,
  topHighlight,
  style,
  children,
}: GradientViewProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `g${rawId}`;
  const sheenId = `s${rawId}`;
  const lastIndex = Math.max(colors.length - 1, 1);

  const [size, setSize] = useState({ width: 0, height: 0 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const w = Math.ceil(width);
    const h = Math.ceil(height);
    setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  };

  const ready = size.width > 0 && size.height > 0;

  // Solid mid-gradient fallback so the tile has color before first layout
  // (and behind any SVG rounding gaps).
  const fallbackColor = colors[Math.floor((colors.length - 1) / 2)];

  return (
    <View
      onLayout={handleLayout}
      style={[{ borderRadius, overflow: 'hidden', backgroundColor: fallbackColor }, style]}
    >
      {ready ? (
        <Svg
          style={StyleSheet.absoluteFill}
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {colors.map((color, index) => (
                <Stop key={`${color}-${index}`} offset={`${(index / lastIndex) * 100}%`} stopColor={color} />
              ))}
            </LinearGradient>
            {sheen ? (
              <LinearGradient id={sheenId} x1="0%" y1="0%" x2="85%" y2="55%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={sheen} />
                <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={sheen * 0.18} />
                <Stop offset="58%" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            ) : null}
          </Defs>
          <Rect x="0" y="0" width={size.width} height={size.height} fill={`url(#${gradientId})`} />
          {sheen ? (
            <Rect x="0" y="0" width={size.width} height={size.height} fill={`url(#${sheenId})`} />
          ) : null}
          {topHighlight ? (
            <Rect x="0" y="0" width={size.width} height={1.5} fill="#FFFFFF" fillOpacity={topHighlight} />
          ) : null}
        </Svg>
      ) : null}
      {children}
    </View>
  );
}
