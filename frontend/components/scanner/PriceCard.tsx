import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { GradientView } from '@/components/ui/GradientView';
import { splitRupeeAmount } from '@/components/scanner/ReviewCardKit';
import { Colors, Gradients } from '@/constants/theme';

interface PriceCardProps {
  label: string;
  amount: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}

/** Mockup .mrp-amount-card — brand gradient pill with label left, ₹ amount right. */
export function PriceCard({ label, amount, subtitle, style }: PriceCardProps) {
  const { rupee, value } = splitRupeeAmount(amount);

  return (
    <GradientView colors={Gradients.brand} borderRadius={14} style={[styles.card, style]}>
      <View style={styles.inner}>
        <View style={styles.labelColumn}>
          <Text style={styles.label}>{label}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.valueRow}>
          {rupee ? <Text style={styles.rupee}>{rupee}</Text> : null}
          <Text style={styles.value}>{value}</Text>
        </View>
      </View>
    </GradientView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  labelColumn: {
    flexShrink: 1,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.58,
    color: 'rgba(255,255,255,0.9)',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  rupee: {
    fontSize: 20.8,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.95)',
  },
  value: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 0,
    color: Colors.white,
  },
});
