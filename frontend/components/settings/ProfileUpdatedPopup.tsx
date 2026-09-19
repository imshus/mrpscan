import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';

interface ProfileUpdatedPopupProps {
  /** Called when it closes itself, which is when the shop lands back on Profile. */
  onDone: () => void;
  duration?: number;
}

/**
 * The mockup's profile-updated toast (`#profileUpdatedToast`).
 *
 * No button, like the other popups here: it says what happened, closes itself
 * and puts the shop back on the Profile screen with the new details on it.
 */
export function ProfileUpdatedPopup({ onDone, duration = 1800 }: ProfileUpdatedPopupProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
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
  }, [duration, opacity, scale]);

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => done.current()}>
      <Pressable style={styles.backdrop} onPress={() => done.current()} accessibilityRole="button">
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={styles.iconWrap}>
            <CheckCircle2 size={26} color={Colors.successText} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>Your profile has been updated successfully</Text>
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
    maxWidth: 320,
    alignItems: 'center',
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.successBg,
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 21,
  },
});
