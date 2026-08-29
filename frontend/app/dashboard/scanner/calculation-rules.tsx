import { Pressable, Text, View } from 'react-native';
import { ToggleLeft, ToggleRight } from 'lucide-react-native';

import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { MOCK_FORMULA_RULES } from '@/constants/scannerData';

export default function CalculationRulesScreen() {
  return (
    <ScanScreenWrapper title="Calculation Rules">
      <Text className="mb-6 text-sm text-text-secondary">
        Configure and enable calculation rules used in the formula engine.
      </Text>

      {MOCK_FORMULA_RULES.map((rule) => (
        <View
          key={rule.id}
          className="mb-3 rounded-2xl border border-border bg-white p-4"
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-base font-semibold text-text-primary">{rule.name}</Text>
              <View className="mt-2 rounded-lg bg-surface-muted px-3 py-2">
                <Text className="font-mono text-xs text-text-secondary">{rule.expression}</Text>
              </View>
            </View>
            <Pressable>
              {rule.isActive ? (
                <ToggleRight size={32} color="#A81F17" />
              ) : (
                <ToggleLeft size={32} color="#857A63" />
              )}
            </Pressable>
          </View>
          <View className="mt-3 flex-row gap-2">
            <View
              className={`rounded-full px-2 py-0.5 ${
                rule.isActive ? 'bg-success-bg' : 'bg-tabInactive'
              }`}
            >
              <Text
                className={`text-[10px] font-semibold ${
                  rule.isActive ? 'text-success-text' : 'text-text-muted'
                }`}
              >
                {rule.isActive ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScanScreenWrapper>
  );
}
