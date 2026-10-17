import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';

import { GradientView } from '@/components/ui/GradientView';
import { Colors, Fonts, Gradients, Spacing } from '@/constants/theme';

interface WishlistScreenHeaderProps {
  /** How many items are ticked; with any, the bin and Add to cart show. */
  selectedCount?: number;
  onDeleteSelected?: () => void;
  onAddToCart?: () => void;
}

/**
 * The close button, then "Wishlist" with the mockup's #wlActions beside it:
 * nothing until an item is ticked, then the bin for the ticked items and the
 * red Add to cart pill.
 */
export function WishlistScreenHeader({
  selectedCount = 0,
  onDeleteSelected,
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
        {selectedCount > 0 ? (
          <View style={styles.actions}>
            {onDeleteSelected ? (
              // .wl-bin-btn: a 36px faint red disc with the red bin.
              <Pressable
                onPress={onDeleteSelected}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={
                  selectedCount === 1 ? 'Remove the selected item' : `Remove ${selectedCount} selected items`
                }
                style={styles.binBtn}
              >
                <Trash2 size={17} color={Colors.brandDeep} strokeWidth={2} />
              </Pressable>
            ) : null}
            {onAddToCart ? (
              // .wl-cart-btn: the red gradient pill.
              <Pressable
                onPress={onAddToCart}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Add ${selectedCount} to cart`}
              >
                <GradientView colors={Gradients.brand} forceGradient borderRadius={999} style={styles.cartBtn}>
                  <Text style={styles.cartBtnText}>Add to cart</Text>
                </GradientView>
              </Pressable>
            ) : null}
          </View>
        ) : null}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    // The buttons come and go; the row keeps its height either way.
    minHeight: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: Fonts.display,
    color: Colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  binBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(217,41,31,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
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
