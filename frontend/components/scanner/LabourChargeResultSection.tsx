import { StyleSheet, Text } from 'react-native';

import { AmountTile, FinRow, MetalTile } from '@/components/scanner/ReviewCardKit';
import { Colors } from '@/constants/theme';
import type { FinalTabPricingResult } from '@/utils/scanPriceCalculation';

interface LabourChargeResultSectionProps {
  pricing: FinalTabPricingResult;
}

export function LabourChargeResultSection({ pricing }: LabourChargeResultSectionProps) {
  const modeLabel = pricing.usePercentageMode
    ? '% Purity Mode'
    : pricing.useFixedAmountMode
      ? 'Fixed Amount Mode'
      : 'Not configured';

  const modeHint = pricing.usePercentageMode
    ? 'Custom % purity selected — labour charge is ₹0; purity drives pure wt recalculation.'
    : pricing.useFixedAmountMode
      ? 'Fixed amount mode active.'
      : 'Enter % purity or fixed labour amount during review.';

  return (
    <>
      <MetalTile title="Labour Charge" tone="plain">
        <FinRow label="Input Mode" value={modeLabel} />
        <Text style={styles.modeHint}>{modeHint}</Text>
      </MetalTile>

      <AmountTile label="Final Labour Amount" value={pricing.labourDisplay} />
    </>
  );
}

const styles = StyleSheet.create({
  modeHint: {
    marginTop: 4,
    fontSize: 10.6,
    lineHeight: 15,
    color: Colors.textMuted,
  },
});
