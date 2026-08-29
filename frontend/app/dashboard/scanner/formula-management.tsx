import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';

import { FormulaListItem } from '@/components/scanner/FormulaListItem';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { MOCK_FORMULAS } from '@/constants/scannerData';

export default function FormulaManagementScreen() {
  const router = useRouter();

  return (
    <ScanScreenWrapper title="Formula Management">
      <View className="mb-6 flex-row items-center justify-between">
        <Text className="flex-1 text-sm text-text-secondary">
          Manage calculation formulas and rules for jewellery valuation.
        </Text>
        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-primary">
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {MOCK_FORMULAS.map((formula) => (
        <FormulaListItem
          key={formula.id}
          formula={formula}
          onPress={() =>
            router.push({
              pathname: '/dashboard/scanner/formula-execution',
              params: { id: formula.id, name: formula.name },
            })
          }
        />
      ))}

      <Pressable
        onPress={() => router.push('/dashboard/scanner/calculation-rules')}
        className="mt-4 items-center rounded-2xl border border-dashed border-accent-gold py-4"
      >
        <Text className="text-sm font-semibold text-accent-gold">Configure Calculation Rules</Text>
      </Pressable>
    </ScanScreenWrapper>
  );
}
