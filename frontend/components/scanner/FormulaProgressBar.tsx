import { Text, View } from 'react-native';

interface ProgressBarProps {
  label: string;
  progress: number;
}

export function FormulaProgressBar({ label, progress }: ProgressBarProps) {
  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-medium text-text-primary">{label}</Text>
        <Text className="text-xs font-semibold text-text-muted">{progress}%</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-tabInactive">
        <View
          className="h-full rounded-full bg-primary"
          style={{ width: `${progress}%` }}
        />
      </View>
    </View>
  );
}
