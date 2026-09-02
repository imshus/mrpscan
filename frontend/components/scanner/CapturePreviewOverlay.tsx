import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { AdjustableImage, type AdjustableImageRef } from '@/components/scanner/AdjustableImage';
import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients } from '@/constants/theme';

interface CapturePreviewOverlayProps {
  visible: boolean;
  loading?: boolean;
  uri?: string | null;
  title?: string;
  showAddMore?: boolean;
  onDelete: () => void;
  /** Receives the cropped uri when the user reframed the capture. */
  onCalculate: (adjustedUri?: string) => void;
  /** A cropped export is ready while the user is still looking; its upload can start now. */
  onAdjusted?: (uri: string) => void;
  onAddMore?: () => void;
}

/** Mockup .cap-preview-overlay + .cap-preview-card (Delete / Add + / Calculate). */
export function CapturePreviewOverlay({
  visible,
  loading = false,
  uri,
  title = 'Captured Image',
  showAddMore = false,
  onDelete,
  onCalculate,
  onAdjusted,
  onAddMore,
}: CapturePreviewOverlayProps) {
  const adjustableRef = useRef<AdjustableImageRef>(null);
  // Half the screen: a 200px strip was too small to land two fingers in,
  // which is why the pinch never seemed to work.
  const { height: windowHeight } = useWindowDimensions();
  const thumbStyle = [styles.thumb, { height: Math.round(windowHeight * 0.5) }];
  const [exporting, setExporting] = useState(false);
  // A reframed image is a new file, and its upload used to start only on
  // Calculate. Export the crop shortly after each gesture ends instead, so the
  // upload runs while the user is still looking at the result. Calculate
  // reuses that export when nothing has moved since; otherwise it exports fresh.
  const gestureVersionRef = useRef(0);
  const exportRef = useRef<{ version: number; uri: string } | null>(null);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    gestureVersionRef.current = 0;
    exportRef.current = null;
    return () => {
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    };
  }, [uri]);
  const handleAdjustEnd = () => {
    gestureVersionRef.current += 1;
    const version = gestureVersionRef.current;
    if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    exportTimerRef.current = setTimeout(() => {
      exportTimerRef.current = null;
      void (async () => {
        const exported = await adjustableRef.current?.exportAdjusted();
        // Another gesture ended meanwhile; its own timer will export again.
        if (!exported || gestureVersionRef.current !== version) return;
        exportRef.current = { version, uri: exported };
        onAdjusted?.(exported);
      })();
    }, 350);
  };

  if (!visible) {
    return null;
  }

  const handleCalculate = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      if (exportTimerRef.current) {
        clearTimeout(exportTimerRef.current);
        exportTimerRef.current = null;
      }
      const ready = exportRef.current;
      const adjusted =
        ready && ready.version === gestureVersionRef.current
          ? ready.uri
          : await adjustableRef.current?.exportAdjusted();
      onCalculate(adjusted ?? undefined);
    } finally {
      setExporting(false);
    }
  };

  // The card lives in its own window. As a sibling of the camera it was being
  // composited beneath the CameraView's SurfaceView on some Android devices,
  // so the live feed bled through the card, its buttons and the scrim alike —
  // no opacity anywhere in the tree, just the surface drawn over the top. A
  // Modal is a separate window and always lands above that surface.
  // AdjustableImage's reframe uses PanResponder, which needs no gesture root.
  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={() => {
        if (!loading) onDelete();
      }}
    >
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>

        {loading ? (
          <View style={thumbStyle}>
            <ActivityIndicator size="large" color={Colors.brandDeep} />
          </View>
        ) : uri ? (
          <AdjustableImage
            ref={adjustableRef}
            uri={uri}
            style={thumbStyle}
            onAdjustEnd={handleAdjustEnd}
          />
        ) : null}

        <View style={styles.actions}>
          <View style={styles.actionRow}>
            <Pressable
              onPress={onDelete}
              style={styles.rowButton}
            >
              <Text style={styles.deleteLabel}>{loading ? 'Cancel' : 'Delete'}</Text>
            </Pressable>

            {showAddMore && !loading && uri ? (
              <Pressable
                onPress={onAddMore}
                style={styles.rowButton}
              >
                <Text style={styles.addMoreLabel}>
                  Add <Text style={styles.addMorePlus}>+</Text>
                </Text>
              </Pressable>
            ) : null}
          </View>

          {!loading && uri ? (
            <Pressable
              onPress={handleCalculate}
              disabled={exporting}
              style={styles.calcPressable}
            >
              <GradientView colors={Gradients.brand} borderRadius={12} style={styles.calcButton}>
                {exporting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.calcLabel}>Calculate</Text>
                )}
              </GradientView>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    // Solid, not a tint: the live camera feed used to show through a 72%
    // scrim around the card, which read as a transparent popup.
    backgroundColor: Colors.scannerBg,
  },
  // Mockup .cap-preview-card: 94% wide, radius 24, padding 26, gap 16.
  card: {
    width: '94%',
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 12.8,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  // Mockup .cap-preview-thumb: full width, 200 tall, radius 16.
  thumb: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actions: {
    width: '100%',
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rowButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.brandDeep,
  },
  addMoreLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addMorePlus: {
    color: Colors.brand,
  },
  calcPressable: {
    width: '100%',
  },
  calcButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  pressed: {
    opacity: 0.9,
  },
});
