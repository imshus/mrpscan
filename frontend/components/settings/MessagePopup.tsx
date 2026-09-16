import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';

interface MessagePopupProps {
  /** The message to show. Null keeps the popup closed. */
  message: string | null;
  onDismiss: () => void;
  /** How long it stays up before closing itself. */
  duration?: number;
  tone?: 'success' | 'error';
}

/**
 * A popup that says what happened and then leaves.
 *
 * There is nothing to press: it fades in, waits, and fades out on its own, so
 * saving a bullion house does not cost an extra tap to acknowledge. Tapping
 * anywhere dismisses it early for anyone who has already read it.
 */
export function MessagePopup({
  message,
  onDismiss,
  duration = 2600,
  tone = 'success',
}: MessagePopupProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  // Held in a ref so the fade-out timer never closes over a stale callback.
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        dismiss.current();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, opacity, scale]);

  if (!message) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button">
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={[styles.iconWrap, tone === 'error' && styles.iconWrapError]}>
            <CheckCircle2
              size={22}
              color={tone === 'error' ? Colors.brandDeep : Colors.successText}
              strokeWidth={2.2}
            />
          </View>
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {message}
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 18, 13, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    paddingHorizontal: 24,
    paddingVertical: 26,
    shadowColor: '#15120D',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.successBg,
  },
  iconWrapError: { backgroundColor: '#FBE9E7' },
  message: {
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
});
