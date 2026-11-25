import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CloudDownload } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';
import { checkAppStoreUpdate, openAppStoreUpdate, type AppStoreUpdate } from '@/utils/appStore';
import { notifyUpdateAvailable } from '@/utils/localNotifications';

/**
 * "New version available" on iPhone whenever the App Store holds a newer
 * version than the one running (owner, 25 Nov 2026), the same as Android's
 * Google Play popup (AppUpdatePopup.android.tsx):
 * - Update Now opens MRPscan's App Store page.
 * - Update Later closes it until the app is next opened or brought back.
 * - A notification goes with it, once per new version.
 * It names only Apple's own store, so nothing of Google Play reaches the iOS
 * bundle (App Store Review 2.3.10). On the web it renders nothing.
 */
export function AppUpdatePopup({ enabled }: { enabled: boolean }) {
  const [update, setUpdate] = useState<AppStoreUpdate | null>(null);
  const checking = useRef(false);
  const opacity = useRef(new Animated.Value(0)).current;

  const check = useCallback(async () => {
    if (Platform.OS !== 'ios' || checking.current) return;
    checking.current = true;
    try {
      const found = await checkAppStoreUpdate();
      setUpdate(found);
      if (found) void notifyUpdateAvailable(found.storeVersion);
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => subscription.remove();
  }, [enabled, check]);

  useEffect(() => {
    if (!update) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [update, opacity]);

  if (!update) return null;

  const later = () => setUpdate(null);
  const now = () => {
    const pending = update;
    setUpdate(null);
    void openAppStoreUpdate(pending);
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={later}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity }]}>
          <View style={styles.iconWrap}>
            <CloudDownload size={22} color={Colors.brandDeep} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>New version available</Text>
          <Text style={styles.message}>
            A new version of MRPscan is available on the App Store. Update now to get the latest features
            and fixes.
          </Text>
          <Pressable onPress={now} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryLabel}>Update Now</Text>
          </Pressable>
          <Pressable onPress={later} style={styles.secondary} accessibilityRole="button">
            <Text style={styles.secondaryLabel}>Update Later</Text>
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
  primary: {
    alignSelf: 'stretch',
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.brandDeep,
    alignItems: 'center',
  },
  primaryLabel: { fontSize: 14, fontWeight: '800', color: Colors.white },
  secondary: {
    alignSelf: 'stretch',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.brandDeep,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  secondaryLabel: { fontSize: 14, fontWeight: '800', color: Colors.brandDeep },
});
