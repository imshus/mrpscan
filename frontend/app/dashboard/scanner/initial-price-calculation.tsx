import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PriceCard } from '@/components/scanner/PriceCard';
import { PrimaryGreenButton } from '@/components/scanner/PrimaryGreenButton';
import { FinRow, MetalTile } from '@/components/scanner/ReviewCardKit';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { Colors } from '@/constants/theme';

const BREAKDOWN = [
  { label: 'Gold Base Value', value: '₹1,45,230' },
  { label: 'Making Charges', value: '₹17,428' },
  { label: 'Diamond Value', value: '₹11,400' },
  { label: 'GST (3%)', value: '₹10,442' },
];

export default function InitialPriceCalculationScreen() {
  const router = useRouter();

  return (
    <ScanScreenWrapper
      title="Initial Price Calculation"
      scanButtonVariant="green"
      footer={
        <PrimaryGreenButton
          title="View Scan Results"
          onPress={() => router.push('/dashboard/scanner/scan-results')}
        />
      }
    >
      <PriceCard
        label="Net Calculated Price"
        amount="₹1,84,500"
        subtitle="Inclusive of 3% GST"
      />

      <MetalTile title="Price Breakdown" tone="plain">
        {BREAKDOWN.map((item) => (
          <FinRow key={item.label} label={item.label} value={item.value} />
        ))}
      </MetalTile>

      <View style={styles.successNote}>
        <Text style={styles.successNoteText}>
          All formula rules executed successfully
        </Text>
      </View>
    </ScanScreenWrapper>
  );
}

const styles = StyleSheet.create({
  successNote: {
    backgroundColor: Colors.successBg,
    borderRadius: 12,
    padding: 12,
  },
  successNoteText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: Colors.successText,
  },
});
