import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';

interface WishlistScreenHeaderProps {
  onClearWishlist: () => void;
}

export function WishlistScreenHeader({ onClearWishlist }: WishlistScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.wrapper}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <X size={18} color={Colors.textPrimary} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>Wishlist</Text>
        <Pressable onPress={onClearWishlist} hitSlop={8}>
          <Text style={styles.clearLink}>Clear Wishlist</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 17,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: Fonts.display,
    color: Colors.textPrimary,
  },
  clearLink: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 4,
  },
});
