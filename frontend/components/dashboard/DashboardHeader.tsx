import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Heart, Menu } from 'lucide-react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';

export function DashboardHeader() {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <Pressable
        style={styles.menuBtn}
        hitSlop={8}
        onPress={() => router.push('/dashboard/settings')}
      >
        <Menu size={18} color={Colors.textPrimary} />
      </Pressable>

      <Text style={styles.brandTitle}>Pratham International</Text>

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
