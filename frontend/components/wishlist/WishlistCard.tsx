import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import type { WishlistItem } from '@/types/wishlist';
import { formatWishlistAge } from '@/utils/wishlistUtils';

function formatWishlistAmount(amount: number) {
  return `₹ ${Math.round(amount).toLocaleString('en-IN')}`;
}

interface WishlistCardProps {
  item: WishlistItem;
  onPress: () => void;
  onDelete: () => void;
}

/**
 * Wishlist row per the mockup: the piece's name (with its tag code when it
 * has one) against how long ago it was saved, then the red price pill
 * carrying the rate it was calculated at, and the delete disc.
 */
export function WishlistCard({ item, onPress, onDelete }: WishlistCardProps) {
  const title =
    item.title && item.tagCode && item.title !== item.tagCode
      ? `${item.title} · ${item.tagCode}`
      : item.title || item.tagCode || 'Saved item';

  return (
    // Styles are plain objects on purpose: NativeWind's css-interop drops the
    // function form of `style` on Pressable, leaving the element unstyled.
    <Pressable onPress={onPress} style={styles.card}>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 8,
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
