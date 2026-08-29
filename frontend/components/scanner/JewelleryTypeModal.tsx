import { Text, View } from 'react-native';

import { JewelleryTypeSelector } from '@/components/scanner/JewelleryTypeSelector';
import type { JewelleryType } from '@/types/scanner';

interface JewelleryTypeModalProps {
  onTypeSelected: (type: JewelleryType) => void;
}

export function JewelleryTypeModal({ onTypeSelected }: JewelleryTypeModalProps) {
  return (
    <View className="rounded-[20px] bg-white px-6 py-7 shadow-lg">
      <Text className="text-lg font-bold text-text-primary">Select Jewellery Type</Text>
      <View className="mt-6">
        <JewelleryTypeSelector variant="buttons" onSelect={onTypeSelected} />
      </View>
    </View>
  );
}
