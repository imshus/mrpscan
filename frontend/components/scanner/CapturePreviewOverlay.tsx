import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients } from '@/constants/theme';

interface CapturePreviewOverlayProps {
  visible: boolean;
  loading?: boolean;
  uri?: string | null;
  title?: string;
  showAddMore?: boolean;
  onDelete: () => void;
  onCalculate: () => void;
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
  onAddMore,
}: CapturePreviewOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>

        {loading ? (
          <View style={styles.thumb}>
            <ActivityIndicator size="large" color={Colors.brandDeep} />
          </View>
        ) : uri ? (
          <View style={styles.thumb}>
            <Image source={{ uri }} style={styles.thumbImage} resizeMode="contain" />
          </View>
        ) : null}

        <View style={styles.actions}>
          <View style={styles.actionRow}>
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => [styles.rowButton, pressed && styles.pressed]}
            >
              <Text style={styles.deleteLabel}>{loading ? 'Cancel' : 'Delete'}</Text>
            </Pressable>

            {showAddMore && !loading && uri ? (
              <Pressable
                onPress={onAddMore}
                style={({ pressed }) => [styles.rowButton, pressed && styles.pressed]}
              >
                <Text style={styles.addMoreLabel}>Add +</Text>
              </Pressable>
            ) : null}
          </View>

          {!loading && uri ? (
            <Pressable
              onPress={onCalculate}
              style={({ pressed }) => [styles.calcPressable, pressed && styles.pressed]}
            >
              <GradientView colors={Gradients.brand} borderRadius={12} style={styles.calcButton}>
                <Text style={styles.calcLabel}>Calculate</Text>
              </GradientView>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  card: {
    width: '86%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 14,
  },
  title: {
    fontSize: 12.8,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  thumb: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
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
