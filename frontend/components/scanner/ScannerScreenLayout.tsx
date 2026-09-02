import { useId, useState, type RefObject } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter, type Href } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients } from '@/constants/theme';
import {
  SCANNER_FRAME_HEIGHT,
  SCANNER_FRAME_VERTICAL_BIAS,
  SCANNER_FRAME_WIDTH,
} from '@/constants/scannerFrame';
import { TagCameraPreview, type TagCameraPreviewRef } from './TagCameraPreview';

/** Re-exported so existing overlay imports keep working. */
export { SCANNER_FRAME_HEIGHT, SCANNER_FRAME_WIDTH } from '@/constants/scannerFrame';

// Mockup .cap-action-btn svg: 20x20, stroke-width 2.
const ACTION_ICON_SIZE = 20;
const ACTION_ICON_STROKE_WIDTH = 2;

/** Exact camera glyph from the mockup's #capShutterBtn (index.html).
 *  fill="none" is set on every shape explicitly — react-native-svg defaults
 *  shapes to black fill and does NOT reliably inherit fill from the parent
 *  <Svg>, so relying on the root fill renders dark blobs on Android. */
function CapScanIcon({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <Svg width={ACTION_ICON_SIZE} height={ACTION_ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h2.5l1.2-2h8.6l1.2 2H20a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"
        fill="none"
        stroke={color}
        strokeWidth={ACTION_ICON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={12}
        cy={13}
        r={3.6}
        fill="none"
        stroke={color}
        strokeWidth={ACTION_ICON_STROKE_WIDTH}
      />
    </Svg>
  );
}

/** Exact image glyph from the mockup's #capUploadBtn (index.html). */
function CapUploadIcon({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <Svg width={ACTION_ICON_SIZE} height={ACTION_ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3}
        y={4}
        width={18}
        height={16}
        rx={2}
        fill="none"
        stroke={color}
        strokeWidth={ACTION_ICON_STROKE_WIDTH}
      />
      <Circle cx={8.5} cy={9.5} r={1.5} fill={color} />
      <Path
        d="M21 15l-5-5-9 9"
        fill="none"
        stroke={color}
        strokeWidth={ACTION_ICON_STROKE_WIDTH}
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
  /** Releases the camera while the gallery picker is open. */
  cameraPaused?: boolean;
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
  cameraPaused = false,
}: ScannerScreenLayoutProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(true);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fadeId = `capTopFade${rawId}`;

  // The blurred surround is built from four pieces around the frame, so it
  // needs the container's real pixel size (the frame is positioned in %).
  const [rootSize, setRootSize] = useState({ width: 0, height: 0 });
  const handleRootLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const w = Math.ceil(width);
    const h = Math.ceil(height);
    setRootSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  };

  const frameLeft = Math.round((rootSize.width - SCANNER_FRAME_WIDTH) / 2);
  const frameTop = Math.round(rootSize.height / 2 - SCANNER_FRAME_HEIGHT * SCANNER_FRAME_VERTICAL_BIAS);
  const frameRight = frameLeft + SCANNER_FRAME_WIDTH;
  const frameBottom = frameTop + SCANNER_FRAME_HEIGHT;

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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/dashboard' as Href);
  };

  return (
    <View style={styles.root} onLayout={handleRootLayout}>
      <View style={StyleSheet.absoluteFill}>
        <TagCameraPreview
          ref={cameraRef}
          paused={cameraPaused}
          onPermissionChange={setCameraPermissionGranted}
        />
      </View>

      {/* Everything outside the capture frame is blurred and dimmed so only the
          scan area reads sharp. Four pieces around the frame leave it untouched;
          a single overlay with a hole isn't possible with a native blur view. */}
      {cameraPermissionGranted && rootSize.width > 0 && rootSize.height > 0 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BlurView
            intensity={38}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={[styles.mask, { top: 0, left: 0, right: 0, height: frameTop }]}
          />
          <BlurView
            intensity={38}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={[styles.mask, { top: frameBottom, left: 0, right: 0, bottom: 0 }]}
          />
          <BlurView
            intensity={38}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={[styles.mask, { top: frameTop, left: 0, width: frameLeft, height: SCANNER_FRAME_HEIGHT }]}
          />
          <BlurView
            intensity={38}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={[
              styles.mask,
              { top: frameTop, left: frameRight, width: Math.max(0, rootSize.width - frameRight), height: SCANNER_FRAME_HEIGHT },
            ]}
          />
        </View>
      ) : null}

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
      </View>

      {/* Mockup: the instruction sits centered directly above the capture frame. */}
      {cameraPermissionGranted && rootSize.height > 0 ? (
        <Text style={[styles.instruction, { top: Math.max(frameTop - 36, 70) }]} pointerEvents="none">
          {instruction}
        </Text>
      ) : null}

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

          {/* Mockup .cap-controls — Click / Upload Image pills.
              Plain style objects only: function-style props on Pressable get
              dropped by the css-interop wrapper here, which stripped the pill
              styling entirely on device. */}
          {/* Mockup .cap-controls sits 20px below the frame, not at the screen bottom. */}
          {!controlsHidden ? (
            <View style={[styles.controls, { top: frameBottom + 20 }]}>
              <Pressable onPress={onShutterPress} style={styles.actionSlot}>
                <GradientView
                  colors={Gradients.brand}
                  borderRadius={999}
                  style={styles.actionButton}
                >
                  <CapScanIcon color={Colors.white} />
                  <Text style={styles.scanLabel}>Click</Text>
                </GradientView>
              </Pressable>

              <Pressable onPress={onUploadPress} style={styles.actionSlot}>
                <View style={[styles.actionButton, styles.uploadButton]}>
                  <CapUploadIcon color={Colors.textPrimary} />
                  <Text style={styles.uploadLabel}>Upload Image</Text>
                </View>
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
  // Mockup .cap-instruction: centered 36px above the frame, inset 16px.
  instruction: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 25,
    textAlign: 'center',
    color: Colors.white,
    fontSize: 13.6,
    fontWeight: '600',
    letterSpacing: 0.14,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  headerContent: {
    marginTop: 100,
    paddingHorizontal: 24,
  },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(11,9,6,0.4)',
    overflow: 'hidden',
  },
  frame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: SCANNER_FRAME_WIDTH,
    height: SCANNER_FRAME_HEIGHT,
    // Mockup: transform: translate(-50%, -60%)
    marginLeft: -SCANNER_FRAME_WIDTH / 2,
    marginTop: -SCANNER_FRAME_HEIGHT * SCANNER_FRAME_VERTICAL_BIAS,
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
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 25,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  // Mockup .cap-action-btn: flex 1 1 50%, h48, radius 999, gap 8.
  // Primary = red gradient with glow; secondary = near-white cream pill.
  // The 48px pill lives on the inner view so both buttons measure identically:
  // putting it on the Pressable let its `alignItems: center` shrink the
  // gradient child to text height.
  actionSlot: {
    flex: 1,
  },
  actionButton: {
    height: 48,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanLabel: {
    color: Colors.white,
    fontSize: 13.1,
    fontWeight: '700',
  },
  uploadButton: {
    backgroundColor: 'rgba(251,247,240,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  uploadLabel: {
    color: Colors.textPrimary,
    fontSize: 13.1,
    fontWeight: '700',
  },
});
