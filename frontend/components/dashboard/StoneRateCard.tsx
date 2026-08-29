import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import type { StoneRate } from '@/types/rates';
import { formatInr, stoneRateLabel } from '@/utils/rateMappers';

interface StoneRateCardProps {
  rate: StoneRate;
}

export function StoneRateCard({ rate }: StoneRateCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{stoneRateLabel(rate)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.priceRow}>
        <Text style={styles.rateLabel}>Rate</Text>
        <Text style={styles.rateValue}>{formatInr(rate.rate)}</Text>
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
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
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
  },
  rateLabel: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  rateValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
