import { useId, useState, type RefObject } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter, type Href } from 'expo-router';
import { Check, ChevronLeft, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import {
  scannerFrameSize,
  SCANNER_FRAME_VERTICAL_BIAS,
  SCANNER_THUMB_HEIGHT,
  SCANNER_THUMB_WIDTH,
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
/** One colour between two #rrggbb colours, `t` of the way from `from` to `to`. */
function mixHex(from: string, to: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const part = (i: number) =>
    Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${part(0)}${part(1)}${part(2)}`;
}

const PILL_GRADIENT_STEPS = 40;

/**
 * The owner's design: the Click pill runs light red to deep red, left to
 * right. Drawn as narrow solid strips, not an SVG: over the camera surface an
 * SVG fill let the live preview show through the pill, and plain views
 * cannot. At 40 steps the bands are a shade apart, too close to see.
 */
function PillGradient({ from, to }: { from: string; to: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.pillGradient]} pointerEvents="none">
      {Array.from({ length: PILL_GRADIENT_STEPS }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, backgroundColor: mixHex(from, to, i / (PILL_GRADIENT_STEPS - 1)) }}
        />
      ))}
    </View>
  );
}

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
  /** Wording on the shutter pill; "Click" on the first side. */
  shutterLabel?: string;
  /** The shutter is the red pill on the first side, cream once a side is held. */
  shutterTone?: 'primary' | 'secondary';
  /**
   * The camera is still answering the last press: the shutter is dimmed and
   * ignores taps until it has, so one press is one photo.
   */
  shutterBusy?: boolean;
  /** Gallery button beside the frame; shown when there is nothing to discard. */
  onUploadPress?: () => void;
  /** Discard button beside the frame, which takes the scan back to its start. */
  onDeletePress?: () => void;
  /** The red Calculate pill under the shutter, once there is a side to price. */
  onCalculatePress?: () => void;
  /**
   * Holds the Calculate pill until the tag finder has finished with the
   * sides in hand: the shop asked that a scan never start on a side that is
   * still being adjusted. The pill stays in view, dimmed, so it is plainly
   * a wait and not a missing button.
   */
  calculateDisabled?: boolean;
  /** Lets touches reach what is drawn in the frame, for framing a photo in it. */
  frameInteractive?: boolean;
  /**
   * Drawn over the camera, full screen, with the capture frame's rectangle
   * handed to it: a photo being positioned fills the screen so it can be seen
   * while it is moved, and the frame is the part that is kept.
   */
  photoLayer?: (frame: { x: number; y: number; width: number; height: number }) => React.ReactNode;
  cameraRef?: RefObject<TagCameraPreviewRef | null>;
  /**
   * The side already in hand, shown as a small ticked thumbnail above the
   * instruction while the other side is framed — proof the first photo is
   * kept, rather than a screen that looks like starting over.
   */
  capturedPreviewUri?: string | null;
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
  shutterLabel = 'Click',
  shutterTone = 'primary',
  shutterBusy = false,
  onUploadPress,
  onDeletePress,
  onCalculatePress,
  calculateDisabled = false,
  frameInteractive = false,
  photoLayer,
  cameraRef,
  capturedPreviewUri,
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

  // The frame spans the screen but for a narrow margin (scannerFrame.ts);
  // TagCameraPreview cuts the photo to this same box.
  const frame = scannerFrameSize(rootSize.width);
  const frameLeft = Math.round((rootSize.width - frame.width) / 2);
  const frameTop = Math.round(rootSize.height / 2 - frame.height * SCANNER_FRAME_VERTICAL_BIAS);
  const frameRight = frameLeft + frame.width;
  const frameBottom = frameTop + frame.height;
  // The owner's design: corner brackets in proportion to the frame and the
  // gallery / discard button inside its lower right corner. The pills keep
  // their earlier 240 x 48 (the owner's call), centred under the frame.
  const cornerSize = Math.round(Math.min(44, Math.max(26, frame.width * 0.11)));

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

      {photoLayer && rootSize.width > 0 && rootSize.height > 0 ? (
        <View style={StyleSheet.absoluteFill}>
          {photoLayer({
            x: frameLeft,
            y: frameTop,
            width: frame.width,
            height: frame.height,
          })}
        </View>
      ) : null}

      {/* Everything outside the capture frame is blurred and dimmed so only the
          scan area reads sharp. Four pieces around the frame leave it untouched;
          a single overlay with a hole isn't possible with a native blur view. */}
      {(cameraPermissionGranted || photoLayer) && rootSize.width > 0 && rootSize.height > 0 ? (
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
            style={[styles.mask, { top: frameTop, left: 0, width: frameLeft, height: frame.height }]}
          />
          <BlurView
            intensity={38}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={[
              styles.mask,
              { top: frameTop, left: frameRight, width: Math.max(0, rootSize.width - frameRight), height: frame.height },
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
      {(cameraPermissionGranted || photoLayer) && rootSize.height > 0 ? (
        <Text style={[styles.instruction, { top: Math.max(frameTop - 36, 70) }]} pointerEvents="none">
          {instruction}
        </Text>
      ) : null}

      {capturedPreviewUri && rootSize.height > 0 ? (
        <View
          style={[
            styles.capturedThumbWrap,
            // The same size as the capture frame, sitting above the
            // instruction; clamped so a short screen cannot push it under
            // the top bar.
            { top: Math.max(Math.max(frameTop - 36, 70) - (SCANNER_THUMB_HEIGHT + 16), 64) },
          ]}
          pointerEvents="none"
        >
          <Image
            source={{ uri: capturedPreviewUri }}
            style={styles.capturedThumb}
            // The whole crop, letterboxed, never a cover-fit slice of it: this
            // thumbnail is the shop's proof of what was kept, and a cover-fit
            // hid the top line of a tag that the file still had — or did not.
            // It has to show the truth either way.
            resizeMode="contain"
          />
          <View style={styles.capturedTick}>
            <Check size={11} color={Colors.white} strokeWidth={3.2} />
          </View>
        </View>
      ) : null}

      {headerContent ? <View style={styles.headerContent}>{headerContent}</View> : null}

      {/* Drawn once the screen is measured: the frame's size and place come
          from its width and height. */}
      {(cameraPermissionGranted || photoLayer) && rootSize.width > 0 ? (
        <>
          {/* Mockup .cap-frame + .cap-corner brackets */}
          <View
            style={[
              styles.frame,
              { left: frameLeft, top: frameTop, width: frame.width, height: frame.height },
            ]}
            pointerEvents={frameInteractive ? 'box-none' : 'none'}
          >
            <View style={styles.frameClip}>{children}</View>
            <View style={[styles.corner, { width: cornerSize, height: cornerSize }, styles.cornerTL]} />
            <View style={[styles.corner, { width: cornerSize, height: cornerSize }, styles.cornerTR]} />
            <View style={[styles.corner, { width: cornerSize, height: cornerSize }, styles.cornerBR]} />
            <View style={[styles.corner, { width: cornerSize, height: cornerSize }, styles.cornerBL]} />
          </View>

          {/* Mockup .cap-controls — Click / Upload Image pills.
              Plain style objects only: function-style props on Pressable get
              dropped by the css-interop wrapper here, which stripped the pill
              styling entirely on device. */}
          {/* Mockup .cap-controls sits 20px below the frame, not at the screen bottom. */}
          {!controlsHidden ? (
            <>
              {/* Beside the frame: the gallery on the first side, and the
                  discard that returns the scan to its start thereafter. */}
              {onDeletePress || onUploadPress ? (
                <Pressable
                  onPress={onDeletePress ?? onUploadPress}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    onDeletePress ? 'Discard and start again' : 'Upload a photo from the gallery'
                  }
                  style={[
                    styles.sideButton,
                    onDeletePress ? styles.sideButtonDanger : styles.sideButtonLight,
                    // Inside the frame's lower right corner (the owner's design).
                    { top: frameBottom - 44 - 12, left: frameRight - 44 - 12 },
                  ]}
                >
                  {onDeletePress ? (
                    <Trash2 size={19} color={Colors.white} strokeWidth={2} />
                  ) : (
                    <CapUploadIcon color={Colors.textPrimary} />
                  )}
                </Pressable>
              ) : null}

              <View style={[styles.controls, { top: frameBottom + 20 }]}>
                <Pressable
                  onPress={onShutterPress}
                  disabled={shutterBusy}
                  accessibilityState={{ busy: shutterBusy, disabled: shutterBusy }}
                  style={styles.actionSlot}
                >
                  {shutterTone === 'secondary' ? (
                    <View
                      style={[
                        styles.actionButton,
                        styles.uploadButton,
                        shutterBusy && styles.actionButtonHeld,
                      ]}
                    >
                      <Text style={styles.uploadLabel}>{shutterLabel}</Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.actionButton,
                        styles.actionButtonSolid,
                        shutterBusy && styles.actionButtonHeld,
                      ]}
                    >
                      <PillGradient from={Colors.brandLight} to={Colors.brandDeep} />
                      <CapScanIcon color={Colors.white} />
                      <Text style={styles.scanLabel}>{shutterLabel}</Text>
                    </View>
                  )}
                </Pressable>

                {onCalculatePress ? (
                  <>
                    <Text style={styles.orLabel}>OR</Text>
                    <Pressable
                      onPress={onCalculatePress}
                      disabled={calculateDisabled}
                      style={styles.actionSlot}
                    >
                      <View
                        style={[
                          styles.actionButton,
                          styles.actionButtonSolid,
                          calculateDisabled && styles.actionButtonHeld,
                        ]}
                      >
                        <PillGradient from={Colors.brandLight} to={Colors.brandDeep} />
                        <Text style={styles.scanLabel}>
                          {calculateDisabled ? 'Adjusting tag…' : 'Calculate directly'}
                        </Text>
                      </View>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </>
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
  capturedThumbWrap: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 4,
  },
  capturedThumb: {
    // The captured side, large enough that what is in hand can be read; the
    // frame's own shape, at the mockup's size (see scannerFrame.ts).
    width: SCANNER_THUMB_WIDTH,
    height: SCANNER_THUMB_HEIGHT,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: '#1A1712',
  },
  capturedTick: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2FA35C',
    borderWidth: 1.5,
    borderColor: '#0B0906',
  },
  // Mockup .cap-instruction: centered 36px above the frame, inset 16px.
  instruction: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 25,
    textAlign: 'center',
    color: Colors.white,
    fontSize: 15,
    fontWeight: 'bold',
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
    // Placed and sized inline from the measured screen (scannerFrameSize):
    // centred, with its top at height/2 - 0.6 x its height, as the mockup's
    // translate(-50%, -60%).
    position: 'absolute',
  },
  frameClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderRadius: 6,
  },
  corner: {
    position: 'absolute',
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
  // The pills sit under the frame and share its width, stacked with the OR
  // between them when there is something to price.
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 25,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  sideButton: {
    // Placed inline, inside the frame's lower right corner.
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 26,
  },
  sideButtonLight: {
    borderRadius: 14,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.white,
    elevation: 8,
  },
  sideButtonDanger: {
    borderRadius: 22,
    backgroundColor: Colors.primary,
    elevation: 8,
  },
  orLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  // Mockup .cap-action-btn: flex 1 1 50%, h48, radius 999, gap 8.
  // Primary = red gradient with glow; secondary = near-white cream pill.
  // The 48px pill lives on the inner view so both buttons measure identically:
  // putting it on the Pressable let its `alignItems: center` shrink the
  // gradient child to text height.
  actionButtonHeld: {
    opacity: 0.45,
  },
  actionSlot: {
    width: 240,
  },
  actionButton: {
    height: 48,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // The red under the strip gradient (PillGradient), which the strips cover;
  // clipped to the pill's rounded ends.
  actionButtonSolid: {
    backgroundColor: Colors.primary,
    overflow: 'hidden',
    elevation: 8,
  },
  pillGradient: {
    flexDirection: 'row',
  },
  scanLabel: {
    color: Colors.white,
    fontSize: 13.1,
    // 'bold' (Typeface.BOLD), not '800': the phone's system font has no 800
    // and drew it medium.
    fontWeight: 'bold',
  },
  uploadButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.white,
    elevation: 8,
  },
  uploadLabel: {
    color: Colors.textPrimary,
    fontSize: 13.1,
    fontWeight: 'bold',
  },
});
