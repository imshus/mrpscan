import { Pressable, ScrollView, Text, View } from 'react-native';

import { JEWELLERY_TYPES } from '@/constants/scannerData';
import { useScannerStore } from '@/store/scannerStore';
import type { JewelleryType } from '@/types/scanner';

export type JewelleryTypeSelectorVariant = 'modal' | 'chips' | 'buttons';

interface JewelleryTypeSelectorProps {
  variant?: JewelleryTypeSelectorVariant;
  onSelect?: (type: JewelleryType) => void;
  disabled?: boolean;
}

export function JewelleryTypeSelector({
  variant = 'chips',
  onSelect,
  disabled = false,
}: JewelleryTypeSelectorProps) {
  const selectedType = useScannerStore((s) => s.selectedType);
  const setSelectedType = useScannerStore((s) => s.setSelectedType);

  const handleSelect = (type: JewelleryType) => {
    setSelectedType(type);
    onSelect?.(type);
  };

  if (variant === 'buttons') {
    return (
      <View className="flex-row gap-2">
        {JEWELLERY_TYPES.map((type) => {
          const isActive = selectedType === type;
          return (
            <Pressable
              key={type}
              onPress={() => handleSelect(type)}
              disabled={disabled}
              className={`flex-1 items-center rounded-button border py-3 active:opacity-80 ${
                isActive
                  ? 'border-primary bg-primary shadow-md shadow-black/20'
                  : 'border-border bg-white shadow-none'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  isActive ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {type}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (variant === 'modal') {
    return (
      <View>
        <Text className="text-lg font-bold text-text-primary">Select Jewellery Type</Text>
        <Text className="mt-2 text-sm leading-5 text-text-secondary">
          Please select Jewellery type which will be scanned.
        </Text>
        <View className="mt-6">
          <JewelleryTypeSelector variant="buttons" onSelect={onSelect} disabled={disabled} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-1"
    >
      {JEWELLERY_TYPES.map((type) => {
        const isActive = selectedType === type;
        return (
          <Pressable
            key={type}
            onPress={() => handleSelect(type)}
            disabled={disabled}
            className={`rounded-full border px-5 py-2.5 ${
              isActive ? 'border-accent-gold bg-accent-gold' : 'border-border bg-white'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                isActive ? 'text-text-primary' : 'text-text-secondary'
              }`}
            >
              {type}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
