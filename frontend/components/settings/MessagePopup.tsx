import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';

import { PopupCloseButton } from '@/components/ui/PopupCloseButton';
import { Colors, Radius } from '@/constants/theme';

interface MessagePopupProps {
  /** The message to show. Null keeps the popup closed. */
  message: string | null;
  onDismiss: () => void;
  tone?: 'success' | 'error';
  /** The mark in the circle: a tick for news, a warning sign for a refusal. */
  icon?: 'check' | 'alert';
  /** A heading above the message, for a popup that asks for something. */
  title?: string;
  /**
   * A button under the message, for a popup that has somewhere to send the
   * shop ("Purchase Plan", "Recharge Credits"). Tapping it is the caller's
   * to handle; the cross and the backdrop still dismiss.
   */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * A popup that says what happened.
 *
 * It stays until it is closed, at the shop's asking — with the cross in its
 * corner, or by tapping anywhere for anyone who has already read it. It used
 * to close itself after a few seconds, which could take a message away
 * before it had been read.
 */
export function MessagePopup({
  message,
  onDismiss,
  tone = 'success',
  icon = 'check',
  title,
  actionLabel,
  onAction,
}: MessagePopupProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [message, opacity, scale]);

  if (!message) return null;

  const markColor = tone === 'error' ? Colors.brandDeep : Colors.successText;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button">
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <PopupCloseButton onPress={onDismiss} style={styles.close} />
          <View style={[styles.iconWrap, tone === 'error' && styles.iconWrapError]}>
            {icon === 'alert' ? (
              <AlertTriangle size={22} color={markColor} strokeWidth={2.2} />
            ) : (
              <CheckCircle2 size={22} color={markColor} strokeWidth={2.2} />
            )}
          </View>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {message}
          </Text>
          {actionLabel && onAction ? (
            <Pressable onPress={onAction} style={styles.action} accessibilityRole="button">
              <Text style={styles.actionLabel}>{actionLabel}</Text>
            </Pressable>
          ) : null}
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
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
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
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.brandDeep,
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
});
