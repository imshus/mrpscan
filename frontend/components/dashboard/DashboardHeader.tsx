import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Bell, Heart, Menu } from 'lucide-react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { getBusinessProfile, toTitleCase } from '@/utils/businessProfile';
import { useUnseenNotifications } from '@/hooks/useUnseenNotifications';

export function DashboardHeader() {
  const router = useRouter();
  // The shop's own GST-verified name — trade name, or the legal name when the
  // registration carries no trade name. Never the app's name: showing
  // "MRPscan" here told every shop it was looking at somebody else's title,
  // and hid the fact that the name had not loaded. Until it is known the row
  // simply has no title, and the home screen fetches it on arrival.
  const registration = useAuthStore((s) => s.registration);
  const businessName = getBusinessProfile(registration).businessName.trim();
  const unseenNotifications = useUnseenNotifications();

  return (
    <View style={styles.header}>
      <Pressable
        style={styles.menuBtn}
        hitSlop={8}
        onPress={() => router.push('/dashboard/settings')}
      >
        <Menu size={18} color={Colors.textPrimary} />
      </Pressable>

      {/* Two lines, and cased as a name rather than shouted. The GST registry
          returns the legal name in capitals, so a single line turned most
          shops into "PRATHAM INTERNATI…" — the one thing on the screen that
          is theirs, cut in half. */}
      <Text style={styles.brandTitle} numberOfLines={2}>
        {toTitleCase(businessName)}
      </Text>

      <Pressable
        style={styles.menuBtn}
        hitSlop={8}
        onPress={() => router.push('/dashboard/notifications' as Href)}
      >
        <Bell size={16} color={Colors.textPrimary} />
        {/* The mockup's .dash-bell-dot: something has arrived that this
            account has not opened yet. */}
        {unseenNotifications ? <View style={styles.bellDot} /> : null}
      </Pressable>

      <Pressable
        style={styles.wishlistBtn}
        onPress={() => router.push('/dashboard/wishlist' as Href)}
      >
        <Heart size={13} color={Colors.brand} fill={Colors.brand} />
        <Text style={styles.wishlistText}>Wishlist</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: 14,
    paddingBottom: Spacing.xs,
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentGold,
    // Ringed in the page colour so it stays a dot against the bell behind it.
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  brandTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Fonts.display,
    color: Colors.textPrimary,
  },
  wishlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 999,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 6,
  },
  wishlistText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
