import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';

interface AccountCreatedPopupProps {
  /** Null keeps the popup closed. */
  mpin: string | null;
  /** Called when it closes itself, which is when the shop is taken to Home. */
  onDone: () => void;
  /** How long it stays up. Longer than a plain toast: there is a PIN to read. */
  duration?: number;
}

/**
 * The account-created moment, showing the MPIN it was created with.
 *
 * No button to press — the same as the other popups in the app — it closes
 * itself and the shop lands on Home. It stays up longer than a toast because
 * there are four digits to read and remember.
 */
export function AccountCreatedPopup({ mpin, onDone, duration = 4200 }: AccountCreatedPopupProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!mpin) return;

    opacity.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        done.current();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [mpin, duration, opacity, scale]);

  if (!mpin) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => done.current()}>
      <Pressable style={styles.backdrop} onPress={() => done.current()} accessibilityRole="button">
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
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
