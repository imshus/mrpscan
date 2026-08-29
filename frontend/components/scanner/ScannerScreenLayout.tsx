import { useId, useState, type RefObject } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { TagCameraPreview, type TagCameraPreviewRef } from './TagCameraPreview';

/** Mockup .cap-frame — fixed 240x150 capture frame. */
export const SCANNER_FRAME_WIDTH = 240;
export const SCANNER_FRAME_HEIGHT = 150;

/** Exact camera glyph from the mockup's #capShutterBtn (index.html).
 *  fill="none" is set on every shape explicitly — react-native-svg defaults
 *  shapes to black fill and does NOT reliably inherit fill from the parent
 *  <Svg>, so relying on the root fill renders dark blobs on Android. */
function CapScanIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h2.5l1.2-2h8.6l1.2 2H20a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={3.5} fill="none" stroke="#FFFFFF" strokeWidth={2} />
    </Svg>
  );
}

/** Exact image glyph from the mockup's #capUploadBtn (index.html). */
function CapUploadIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={16} rx={2} fill="none" stroke="#FFFFFF" strokeWidth={2} />
      <Circle cx={8.5} cy={9.5} r={1.5} fill="#FFFFFF" />
      <Path
        d="M21 15l-5-5-9 9"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface ScannerScreenLayoutProps {
  children: React.ReactNode;
  instruction: string;
  onShutterPress: () => void;
  onUploadPress?: () => void;
  cameraRef?: RefObject<TagCameraPreviewRef | null>;
  headerContent?: React.ReactNode;
  controlsHidden?: boolean;
}

/**
 * Mockup #screenScanCapture viewfinder: dark #0B0906 full-screen camera,
 * absolute top bar (fade black 0.55 -> transparent) with circular back button
 * + instruction, centered 240x150 frame with brand corner brackets, and
 * bottom pill controls (Scan / Upload Image).
 */
export function ScannerScreenLayout({
  children,
  instruction,
  onShutterPress,
  onUploadPress,
  cameraRef,
  headerContent,
  controlsHidden = false,
}: ScannerScreenLayoutProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(true);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fadeId = `capTopFade${rawId}`;
  const scrimId = `capBottomScrim${rawId}`;

  // Percentage-sized SVGs don't reliably track content-driven heights on
  // Android, so the top fade is drawn at the bar's measured pixel size.
  const [topBarSize, setTopBarSize] = useState({ width: 0, height: 0 });
  const handleTopBarLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const w = Math.ceil(width);
    const h = Math.ceil(height);
    setTopBarSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  };

  // Mockup paddings (52 top / 46 bottom) as minimums, grown for tall notches
  // and gesture bars on real devices.
  const topBarPaddingTop = Math.max(insets.top + 8, 52);
  const controlsBottom = Math.max(insets.bottom + 12, 46);
  // Dark fade behind the bottom pills — the mockup's viewfinder is near-black,
  // so its translucent white pills need a dark base over a live bright camera.
  const scrimHeight = controlsBottom + 46 + 80;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/dashboard' as Href);
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <TagCameraPreview ref={cameraRef} onPermissionChange={setCameraPermissionGranted} />
      </View>

      {/* Mockup .cap-topbar — linear fade + 34px circular back + instruction */}
      <View
        onLayout={handleTopBarLayout}
        style={[styles.topBar, { paddingTop: topBarPaddingTop }]}
        pointerEvents="box-none"
      >
        {topBarSize.width > 0 && topBarSize.height > 0 ? (
          <Svg
            style={StyleSheet.absoluteFill}
            width={topBarSize.width}
            height={topBarSize.height}
            viewBox={`0 0 ${topBarSize.width} ${topBarSize.height}`}
            preserveAspectRatio="none"
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id={fadeId} x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#000000" stopOpacity={0.55} />
                <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={topBarSize.width} height={topBarSize.height} fill={`url(#${fadeId})`} />
          </Svg>
        ) : null}

        <Pressable onPress={handleBack} hitSlop={12} style={styles.backButton}>
          <ChevronLeft size={20} color={Colors.white} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.instruction}>{instruction}</Text>
      </View>

      {headerContent ? <View style={styles.headerContent}>{headerContent}</View> : null}

      {cameraPermissionGranted ? (
        <>
          {/* Mockup .cap-frame + .cap-corner brackets */}
          <View style={styles.frame} pointerEvents="none">
            <View style={styles.frameClip}>{children}</View>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={[styles.corner, styles.cornerBL]} />
          </View>

          {/* Bottom scrim so the translucent pills read like the mockup's dark viewfinder */}
          {!controlsHidden ? (
            <Svg
              style={[styles.bottomScrim, { height: scrimHeight }]}
              width={Math.ceil(screenWidth)}
              height={scrimHeight}
              viewBox={`0 0 ${Math.ceil(screenWidth)} ${scrimHeight}`}
              preserveAspectRatio="none"
              pointerEvents="none"
            >
              <Defs>
                <LinearGradient id={scrimId} x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
                  <Stop offset="100%" stopColor="#000000" stopOpacity={0.6} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={Math.ceil(screenWidth)} height={scrimHeight} fill={`url(#${scrimId})`} />
            </Svg>
          ) : null}

          {/* Mockup .cap-controls — Scan / Upload Image pills */}
          {!controlsHidden ? (
            <View style={[styles.controls, { bottom: controlsBottom }]}>
              <Pressable
                onPress={onShutterPress}
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
              >
                <CapScanIcon />
                <Text style={styles.actionLabel}>Scan</Text>
              </Pressable>

              <Pressable
                onPress={onUploadPress}
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
              >
                <CapUploadIcon />
                <Text style={styles.actionLabel}>Upload Image</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Colors.scannerBg,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingTop: 52,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  instruction: {
    color: Colors.white,
    fontSize: 13.6,
    fontWeight: '600',
  },
  headerContent: {
    marginTop: 100,
    paddingHorizontal: 24,
  },
  frame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: SCANNER_FRAME_WIDTH,
    height: SCANNER_FRAME_HEIGHT,
    // Mockup: transform: translate(-50%, -60%)
    marginLeft: -SCANNER_FRAME_WIDTH / 2,
    marginTop: -SCANNER_FRAME_HEIGHT * 0.6,
  },
  frameClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderRadius: 6,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: Colors.brand,
  },
  cornerTL: { top: 0, left: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 6 },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderBottomRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderBottomLeftRadius: 6,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  controls: {
    position: 'absolute',
    bottom: 46,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  actionButton: {
    flex: 1,
    maxWidth: 160,
    height: 46,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionLabel: {
    color: Colors.white,
    fontSize: 12.8,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.9,
  },
});
