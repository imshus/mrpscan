import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Store } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';

/** The sign-in (its sessionStartedAt) last welcomed on this phone. */
const WELCOMED_SESSION_KEY = 'mrpscan.employeeWelcome.sessionStartedAt';

/**
 * "You are signed in as an employee of <shop>" on Home, at the owner's
 * asking: once per sign-in, the first time an employee reaches Home, so it
 * is plain whose shop they are working in. It waits for the shop's name
 * (the login answer carries it; Home's profile refresh fills it in when it
 * did not). Owners never see it.
 */
export function EmployeeWelcomePopup() {
  const userRole = useAuthStore((s) => s.userRole);
  const sessionStartedAt = useAuthStore((s) => s.sessionStartedAt);
  const businessName = useAuthStore((s) => String(s.registration.businessName ?? '').trim());
  const employeeName = useAuthStore((s) => String(s.registration.fullName ?? '').trim());
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  // Home stays mounted under the pages opened from it; the welcome waits
  // until Home is on screen rather than opening over another page.
  const isFocused = useIsFocused();

  useEffect(() => {
    if (userRole !== 'employee' || !sessionStartedAt || !businessName) {
      setVisible(false);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(WELCOMED_SESSION_KEY)
      .then((welcomed) => {
        if (!cancelled && welcomed !== String(sessionStartedAt)) setVisible(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userRole, sessionStartedAt, businessName]);

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [visible, opacity]);

  if (!visible || !isFocused) return null;

  const dismiss = () => {
    setVisible(false);
    if (sessionStartedAt) {
      AsyncStorage.setItem(WELCOMED_SESSION_KEY, String(sessionStartedAt)).catch(() => {});
    }
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity }]}>
          <View style={styles.iconWrap}>
            <Store size={22} color={Colors.brandDeep} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>{businessName}</Text>
          <Text style={styles.message}>
            {employeeName ? `Hi ${employeeName}, you` : 'You'} are signed in as an employee of{' '}
            <Text style={styles.strong}>{businessName}</Text>.
          </Text>
          {/* Plain styles, not ({ pressed }) functions: under NativeWind the
              function form loses the background (see PopupCloseButton). */}
          <Pressable onPress={dismiss} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryLabel}>OK</Text>
          </Pressable>
        </Animated.View>
      </View>
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
    backgroundColor: '#FBE9E7',
  },
  title: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  strong: { fontWeight: '800', color: Colors.textPrimary },
  primary: {
    alignSelf: 'stretch',
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.brandDeep,
    alignItems: 'center',
  },
  primaryLabel: { fontSize: 14, fontWeight: '800', color: Colors.white },
});
