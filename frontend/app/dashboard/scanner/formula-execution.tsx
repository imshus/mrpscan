import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { PrimaryGreenButton } from '@/components/scanner/PrimaryGreenButton';
import { ProgressStepper } from '@/components/scanner/ProgressStepper';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';

const EXECUTION_STEPS = [
  { id: '1', label: 'Validate Input Variables', status: 'completed' as const },
  { id: '2', label: 'Apply Formula Rules', status: 'completed' as const },
  { id: '3', label: 'Compute Result', status: 'active' as const },
  { id: '4', label: 'Verify Output', status: 'pending' as const },
];

export default function FormulaExecutionScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ id?: string; name?: string }>();

  return (
    <ScanScreenWrapper
      title="Formula Execution"
      footer={
        <PrimaryGreenButton
          title="View Results"
          onPress={() => router.push('/dashboard/scanner/scan-results')}
        />
      }
    >
      <View className="mb-6 rounded-2xl bg-primary px-5 py-4">
        <Text className="text-xs font-semibold uppercase text-white/70">Executing</Text>
        <Text className="mt-1 text-lg font-bold text-white">{name ?? 'Gold Base Value'}</Text>
      </View>

      <View className="mb-6 items-center py-6">
        <ActivityIndicator size="large" color="#A81F17" />
        <Text className="mt-4 text-sm text-text-secondary">Running formula engine...</Text>
      </View>

      <View className="rounded-2xl border border-border bg-white p-5">
        <ProgressStepper steps={EXECUTION_STEPS} />
      </View>

      <View className="mt-6 rounded-2xl border border-border bg-white p-4">
        <Text className="text-xs font-bold uppercase text-text-muted">Sample Output</Text>
        <Text className="mt-2 text-2xl font-bold text-text-primary">₹1,45,230</Text>
        <Text className="mt-1 text-sm text-text-secondary">Gold Base Value calculated</Text>
      </View>
    </ScanScreenWrapper>
  );
}
