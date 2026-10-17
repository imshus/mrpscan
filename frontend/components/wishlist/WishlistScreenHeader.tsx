import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

import { GradientView } from '@/components/ui/GradientView';
import { Colors, Fonts, Gradients, Spacing } from '@/constants/theme';

interface WishlistScreenHeaderProps {
  onClearWishlist: () => void;
  /** How many items are ticked; with any, Add to cart takes Clear Wishlist's place. */
  selectedCount?: number;
  onAddToCart?: () => void;
}

export function WishlistScreenHeader({
  onClearWishlist,
  selectedCount = 0,
  onAddToCart,
}: WishlistScreenHeaderProps) {
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
        {selectedCount > 0 && onAddToCart ? (
          // .wl-cart-btn: the red gradient pill in the title row while items
          // are ticked (mockup #wlActions).
          <Pressable
            onPress={onAddToCart}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Add ${selectedCount} to cart`}
          >
            <GradientView colors={Gradients.brand} forceGradient borderRadius={999} style={styles.cartBtn}>
              <Text style={styles.cartBtnText}>Add to cart ({selectedCount})</Text>
            </GradientView>
          </Pressable>
        ) : (
          <Pressable onPress={onClearWishlist} hitSlop={8}>
            <Text style={styles.clearLink}>Clear Wishlist</Text>
          </Pressable>
        )}
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
    // The pill is taller than the link; the row keeps its height either way.
    minHeight: 36,
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
  // .wl-cart-btn: 36 high, 0 16 padding, 0.78rem extra-bold white.
  cartBtn: {
    height: 36,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.white,
  },
});
