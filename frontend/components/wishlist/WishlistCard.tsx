import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients } from '@/constants/theme';
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

export function WishlistCard({ item, onPress, onDelete }: WishlistCardProps) {
  const rateSource = item.calculationRate ?? item.snapshot?.scanData?.calculationRate;
  const rateLabel = formatRateLabel(rateSource);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.cardPressed]}>
      <View style={styles.card}>
        {/* ─── Header: Title & Timestamp ─── */}
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.timestamp}>
            {formatWishlistTimestamp(item.scanTimestamp || item.addedAt)}
          </Text>
        </View>

        {/* ─── Divider ─── */}
        <View style={styles.divider} />

        {/* ─── Footer: Price & Actions ─── */}
        <View style={styles.bottomRow}>
          <GradientView colors={Gradients.brand} borderRadius={999} style={styles.priceBadge}>
            <Text style={styles.priceText}>{formatWishlistAmount(item.totalMrp)}</Text>
            {rateLabel ? <Text style={styles.rateText}>{rateLabel}</Text> : null}
          </GradientView>

          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            hitSlop={12}
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
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardPressed: {
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  priceBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  rateText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(217,41,31,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
