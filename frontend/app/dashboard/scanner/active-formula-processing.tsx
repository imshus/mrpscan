import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { FormulaProgressBar } from '@/components/scanner/FormulaProgressBar';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { ACTIVE_FORMULA_STEPS } from '@/constants/scannerData';

export default function ActiveFormulaProcessingScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(
      () => router.push('/dashboard/scanner/initial-price-calculation'),
      3000,
    );
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <ScanScreenWrapper title="Active Formula Processing">
      <View className="mb-6 items-center py-4">
        <ActivityIndicator size="large" color="#A81F17" />
        <Text className="mt-4 text-base font-semibold text-text-primary">
          Processing calculation rules...
        </Text>
        <Text className="mt-1 text-sm text-text-secondary">This may take a few seconds</Text>
      </View>

      <View className="rounded-2xl border border-border bg-white p-5">
        {ACTIVE_FORMULA_STEPS.map((step) => (
          <FormulaProgressBar key={step.id} label={step.label} progress={step.progress} />
        ))}
      </View>

      <View className="mt-6 rounded-2xl bg-accent-gold/15 p-4">
        <Text className="text-xs font-bold uppercase text-text-muted">Current Rule</Text>
        <Text className="mt-1 text-sm font-semibold text-text-primary">
          carat_weight × diamond_rate × quality_factor
        </Text>
      </View>
    </ScanScreenWrapper>
  );
}
