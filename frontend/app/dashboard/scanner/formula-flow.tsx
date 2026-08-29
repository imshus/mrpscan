import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PrimaryGreenButton } from '@/components/scanner/PrimaryGreenButton';
import { ProgressStepper } from '@/components/scanner/ProgressStepper';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { FORMULA_EXECUTION_STEPS } from '@/constants/scannerData';

export default function FormulaFlowScreen() {
  const router = useRouter();

  return (
    <ScanScreenWrapper
      title="Formula Execution Flow"
      footer={
        <View className="gap-3">
          <PrimaryGreenButton
            title="Start Processing"
            onPress={() => router.push('/dashboard/scanner/active-formula-processing')}
          />
          <Pressable
            onPress={() => router.push('/dashboard/scanner/formula-management')}
            className="items-center py-2"
          >
            <Text className="text-sm font-medium text-accent-gold">Manage Formulas</Text>
          </Pressable>
        </View>
      }
    >
      <Text className="mb-6 text-sm text-text-secondary">
        Review the formula execution pipeline before calculating the final price.
      </Text>

      <View className="rounded-2xl border border-border bg-white p-5">
        <ProgressStepper steps={FORMULA_EXECUTION_STEPS} />
      </View>

      <View className="mt-6 rounded-2xl bg-primary/5 p-4">
        <Text className="text-xs font-bold uppercase text-text-muted">Active Formula Set</Text>
        <Text className="mt-2 text-base font-semibold text-text-primary">
          Gold Base + Diamond Valuation + GST
        </Text>
        <Text className="mt-1 text-sm text-text-secondary">5 calculation rules configured</Text>
      </View>
    </ScanScreenWrapper>
  );
}
