import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import type { WishlistItem } from '@/types/wishlist';
import { formatWishlistTimestamp } from '@/utils/wishlistUtils';

function formatWishlistAmount(amount: number) {
  return `₹ ${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatRateLabel(rate?: 'rtgs' | 'cash') {
  if (rate === 'rtgs') return 'RTGS Rate';
  if (rate === 'cash') return 'Cash Rate';
  return '';
}

interface WishlistCardProps {
  item: WishlistItem;
  onPress: () => void;
  onDelete: () => void;
}

/**
 * Wishlist row, laid out to the pencil sketch: the item number and the amount
 * each sit in their own outlined box, the time and date run underneath, and the
 * delete control sits at the trailing edge.
 */
export function WishlistCard({ item, onPress, onDelete }: WishlistCardProps) {
  const rateSource = item.calculationRate ?? item.snapshot?.scanData?.calculationRate;
  const rateLabel = formatRateLabel(rateSource);
  // tagCode is the scanned tag/SKU — the number the shop identifies a piece by.
  const itemNo = item.tagCode || item.title;

  return (
    // Styles are plain objects on purpose: NativeWind's css-interop drops the
    // function form of `style` on Pressable, leaving the element unstyled.
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.body}>
        <View style={styles.fields}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Item No.</Text>
            <Text style={styles.fieldValue} numberOfLines={1}>
              {itemNo}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountValue} numberOfLines={1}>
                {formatWishlistAmount(item.totalMrp)}
              </Text>
              {rateLabel ? <Text style={styles.rateText}>{rateLabel}</Text> : null}
            </View>
          </View>
        </View>

        <Pressable
          onPress={(event) => {
            // Without this the row's own onPress also fires and opens the item.
            event.stopPropagation();
            onDelete();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Delete item ${itemNo}`}
          style={styles.deleteBtn}
        >
          <Trash2 size={18} color={Colors.primary} />
        </Pressable>
      </View>

      <Text style={styles.timestamp}>
        {formatWishlistTimestamp(item.scanTimestamp || item.addedAt)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fields: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  field: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  fieldValue: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  amountRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  rateText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(217,41,31,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timestamp: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
