import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

import { PopupCloseButton } from '@/components/ui/PopupCloseButton';
import { Colors, Radius } from '@/constants/theme';

interface AccountCreatedPopupProps {
  /** Null keeps the popup closed. */
  mpin: string | null;
  /** Called when it is closed, which is when the shop is taken to Home. */
  onDone: () => void;
}

/**
 * The account-created moment, showing the MPIN it was created with.
 *
 * It stays until it is closed, at the shop's asking — there are four digits
 * to read and remember, and it used to close itself after four seconds.
 * Closing it (the cross, a tap, or Back) is what takes the shop to Home, so
 * that happens once however it is closed.
 */
export function AccountCreatedPopup({ mpin, onDone }: AccountCreatedPopupProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const done = useRef(onDone);
  done.current = onDone;
  const closed = useRef(false);

  useEffect(() => {
    if (!mpin) return;
    closed.current = false;

    opacity.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [mpin, opacity, scale]);

  const close = () => {
    if (closed.current) return;
    closed.current = true;
    done.current();
  };

  if (!mpin) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button">
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <PopupCloseButton onPress={close} style={styles.close} />
          <View style={styles.iconWrap}>
            <CheckCircle2 size={26} color={Colors.successText} strokeWidth={2.2} />
          </View>

          <Text style={styles.title}>Account created successfully</Text>

          <Text style={styles.label}>Your MPIN</Text>
          <View style={styles.digits}>
            {mpin.split('').map((digit, index) => (
              <View key={index} style={styles.digitBox}>
                <Text style={styles.digit}>{digit}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.note}>
            This is how you sign in from now on. Keep it to yourself.
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 18, 13, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: '#15120D',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.successBg,
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 18,
    marginBottom: 10,
  },
  digits: { flexDirection: 'row', gap: 10 },
  digitBox: {
    width: 48,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#C9B79A',
    borderRadius: Radius.input,
    backgroundColor: Colors.background,
  },
  digit: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  note: {
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
});
