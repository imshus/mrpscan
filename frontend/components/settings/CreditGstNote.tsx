import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { CREDIT_GST_PERCENT, creditRechargeCharge } from '@/utils/subscriptionApi';

const rupees = (value: number) =>
  `₹${value.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;

/**
 * The GST added on top of a credit recharge and the amount Razorpay will
 * charge, under the amount the shop picked: ₹500 of credits is ₹590 to pay.
 * Nothing while no amount is picked.
 */
export function CreditGstNote({ credits }: { credits: number }) {
  if (!(credits > 0)) return null;
  const { gst, total } = creditRechargeCharge(credits);
  return (
    <View style={styles.row} accessibilityLabel={`Plus GST ${CREDIT_GST_PERCENT} percent, ${rupees(gst)}. You pay ${rupees(total)}.`}>
      <Text style={styles.gst}>
        Plus GST ({CREDIT_GST_PERCENT}%) {rupees(gst)}
      </Text>
      <Text style={styles.total}>You pay {rupees(total)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  gst: { fontSize: 12.5, fontWeight: '600', color: Colors.textSecondary },
  total: { fontSize: 13.5, fontWeight: '800', color: Colors.textPrimary },
});
