import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Trash2 } from 'lucide-react-native';

import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients } from '@/constants/theme';
import type { WishlistItem } from '@/types/wishlist';
import { roundHalfUp } from '@/utils/moneyMath';
import { formatWishlistAge } from '@/utils/wishlistUtils';

function formatWishlistAmount(amount: number) {
  return `₹ ${roundHalfUp(amount).toLocaleString('en-IN')}`;
}

interface WishlistCardProps {
  item: WishlistItem;
  onPress: () => void;
  onDelete: () => void;
  /** Ticked for the cart. */
  selected?: boolean;
  /** Ticks or unticks it; without it the card has no tick circle. */
  onToggleSelect?: () => void;
}

/**
 * Wishlist row per the mockup: the tick circle that puts it in the cart, the
 * piece's name (with its tag code when it has one) against how long ago it
 * was saved, then the red price pill carrying the rate it was calculated at,
 * and the delete disc. Tapping anywhere but the circle opens the item.
 */
export function WishlistCard({
  item,
  onPress,
  onDelete,
  selected = false,
  onToggleSelect,
}: WishlistCardProps) {
  const title =
    item.title && item.tagCode && item.title !== item.tagCode
      ? `${item.title} · ${item.tagCode}`
      : item.title || item.tagCode || 'Saved item';

  return (
    // Styles are plain objects on purpose: NativeWind's css-interop drops the
    // function form of `style` on Pressable, leaving the element unstyled.
    <Pressable onPress={onPress} style={[styles.card, selected && styles.cardSelected]}>
      {onToggleSelect ? (
        // .wl-check: a 22px circle, filled red with a tick once selected.
        <Pressable
          onPress={(event) => {
            // Without this the row's own onPress also fires and opens the item.
            event.stopPropagation();
            onToggleSelect();
          }}
          hitSlop={12}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={`Select ${title}`}
        >
          {selected ? (
            <GradientView colors={Gradients.brand} forceGradient borderRadius={11} style={styles.checkOn}>
              <Check size={14} color={Colors.white} strokeWidth={3} />
            </GradientView>
          ) : (
            <View style={styles.checkOff} />
          )}
        </Pressable>
      ) : null}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.age}>{formatWishlistAge(item.scanTimestamp || item.addedAt)}</Text>
        </View>

        {item.savedBy ? <Text style={styles.savedBy}>Saved by {item.savedBy}</Text> : null}

        <View style={styles.bottomRow}>
          <View style={styles.pricePill}>
            <Text style={styles.priceText}>{formatWishlistAmount(item.totalMrp)}</Text>
            <Text style={styles.priceCaption}>
              {item.calculationRate === 'cash' ? 'Cash Rate' : 'RTGS Rate'}
            </Text>
          </View>

          <Pressable
            onPress={(event) => {
              // Without this the row's own onPress also fires and opens the item.
              event.stopPropagation();
              onDelete();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${title}`}
            style={styles.deleteBtn}
          >
            <Trash2 size={16} color={Colors.brandDeep} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  // .wl-card.selected: the deep red border on a faint red ground.
  cardSelected: {
    borderColor: Colors.brandDeep,
    backgroundColor: '#FFF8F6',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  checkOff: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  checkOn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  age: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  savedBy: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pricePill: {
    backgroundColor: Colors.brandDeep,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  priceCaption: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.85)',
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
