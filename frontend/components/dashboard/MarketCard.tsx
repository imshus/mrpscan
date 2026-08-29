import { StyleSheet, Text, View } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import type { MarketItem } from '@/types/auth';

const BUTTON_GREEN = '#A81F17';

interface MarketCardProps {
  item: MarketItem;
}

function formatPrice(value: number) {
  return `₹ ${value.toLocaleString('en-IN')}/g`;
}

export function MarketCard({ item }: MarketCardProps) {
  const isPositive = item.changePercent >= 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <View style={[styles.badge, isPositive ? styles.badgeUp : styles.badgeDown]}>
          {isPositive ? (
            <TrendingUp size={12} color={Colors.successText} />
          ) : (
            <TrendingDown size={12} color={Colors.dangerText} />
          )}
          <Text style={[styles.badgeText, isPositive ? styles.textUp : styles.textDown]}>
            {isPositive ? '+' : ''}
            {item.changePercent}%
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.priceRow}>
        <View style={styles.basePriceCol}>
          <Text style={styles.basePrice}>{formatPrice(item.basePrice)}</Text>
          <Text style={styles.basePriceLabel}>(Base Price)</Text>
        </View>

        <View style={styles.taxBtn}>
          <Text style={styles.taxPrice}>{formatPrice(item.totalPrice)}</Text>
          <Text style={styles.taxLabel}>(Including Tax)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  badgeUp: {
    backgroundColor: Colors.successBg,
  },
  badgeDown: {
    backgroundColor: Colors.dangerBg,
  },
  badgeText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  textUp: {
    color: Colors.successText,
  },
  textDown: {
    color: Colors.dangerText,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  basePriceCol: {
    flex: 1,
  },
  basePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  basePriceLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  taxBtn: {
    backgroundColor: BUTTON_GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 130,
  },
  taxPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  taxLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
});
