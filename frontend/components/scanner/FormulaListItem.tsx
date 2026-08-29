import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import type { FormulaItem } from '@/types/scanner';

interface FormulaListItemProps {
  formula: FormulaItem;
  onPress: () => void;
}

export function FormulaListItem({ formula, onPress }: FormulaListItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-2xl border border-border bg-white p-4"
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-semibold text-text-primary">{formula.name}</Text>
          {formula.isActive ? (
            <View className="rounded-full bg-success-bg px-2 py-0.5">
              <Text className="text-[10px] font-semibold text-success-text">Active</Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1 text-sm text-text-secondary">{formula.description}</Text>
        <Text className="mt-2 text-xs text-text-muted">
          {formula.rulesCount} rules · Last used {formula.lastUsed}
        </Text>
      </View>
      <ChevronRight size={20} color="#857A63" />
    </Pressable>
  );
}
