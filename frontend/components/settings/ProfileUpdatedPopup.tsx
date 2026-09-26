import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { PopupCloseButton } from '@/components/ui/PopupCloseButton';

interface ProfileUpdatedPopupProps {
  /** Called when it is closed, which is when the shop lands back on Profile. */
  onDone: () => void;
}

/**
 * The mockup's profile-updated toast (`#profileUpdatedToast`).
 *
 * It stays until it is closed, at the shop's asking — the cross, a tap, or
 * Back — and closing it puts the shop back on the Profile screen with the new
 * details on it, once however it is closed.
 */
export function ProfileUpdatedPopup({ onDone }: ProfileUpdatedPopupProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const done = useRef(onDone);
  done.current = onDone;
  const closed = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  const close = () => {
    if (closed.current) return;
    closed.current = true;
    done.current();
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button">
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={styles.iconWrap}>
            <Check size={15} color="#FFFFFF" strokeWidth={3} />
          </View>
          <Text style={styles.title}>Your profile has been updated successfully</Text>
          <PopupCloseButton onPress={close} color="#FFFDF9" />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// The mockup's `.success-toast.center-popup`, taken as written: an ink-dark
// horizontal toast — solid green check circle, cream text beside it — centred
// over a 45% backdrop, not a white card.
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 18, 13, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#15120D',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#15120D',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A8A4A',
  },
  title: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFDF9',
    lineHeight: 18,
  },
});
