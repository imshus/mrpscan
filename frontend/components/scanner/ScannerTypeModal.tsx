import { Pressable, Text, View } from 'react-native';

interface ScannerTypeModalProps {
  onSingleSide: () => void;
  onBothSide: () => void;
}

export function ScannerTypeModal({ onSingleSide, onBothSide }: ScannerTypeModalProps) {
  return (
    <View className="rounded-[20px] bg-white px-6 py-7 shadow-lg">
      <Text className="text-lg font-bold text-text-primary">Select Scanner Type</Text>

      <View className="mt-6 gap-3">
        <Pressable
          onPress={onSingleSide}
          className="items-center rounded-[12px] bg-primary py-[15px] active:opacity-80"
        >
          <Text className="text-sm font-semibold text-white">Single Side Scan</Text>
        </Pressable>

        <Pressable
          onPress={onBothSide}
          className="items-center rounded-[12px] bg-primary py-[15px] active:opacity-80"
        >
          <Text className="text-sm font-semibold text-white">Both Side Scan</Text>
        </Pressable>
      </View>
    </View>
  );
}
