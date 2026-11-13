import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

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
  /** Ticked, for the cart or the bin. */
  selected?: boolean;
  /** Ticks or unticks it; without it the card has no tick circle. */
  onToggleSelect?: () => void;
}

/**
 * Wishlist row as the mockup's slim card has it, all on one line: the tick
 * circle, the piece's name over how long ago it was saved, and the red price
 * pill. Removing goes through the ticks and the bin in the title row, so the
 * card has no delete of its own. Tapping anywhere but the circle opens the
 * item.
 */
export function WishlistCard({ item, onPress, selected = false, onToggleSelect }: WishlistCardProps) {
  const title = item.title || item.tagCode || 'Saved item';
  const age = formatWishlistAge(item.scanTimestamp || item.addedAt);
  // An employee's save, seen by the owner, still says whose it was.
  const sub = item.savedBy ? `${age} · Saved by ${item.savedBy}` : age;

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
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.age} numberOfLines={1}>
          {sub}
        </Text>
      </View>

      {/* .wl-price-pill: the red gradient pill, the price alone. */}
      <GradientView colors={Gradients.brand} forceGradient borderRadius={999} style={styles.pricePill}>
        <Text style={styles.priceText}>{formatWishlistAmount(item.totalMrp)}</Text>
      </GradientView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // .wl-card (slim): 10 12 padding, 12 gap, radius 14, 10 between cards.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  // .wl-card.selected: the deep red border on a faint red ground.
  cardSelected: {
    borderColor: Colors.brandDeep,
    backgroundColor: '#FFF8F6',
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
  body: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  // .wl-card-title: 0.88rem, 800.
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  // .wl-card-time: 0.68rem, 600, dim.
  age: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  // .wl-price-pill: 6 13 padding; b at 0.82rem, 700.
  pricePill: {
    flexShrink: 0,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
});
