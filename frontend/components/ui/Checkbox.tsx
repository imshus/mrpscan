import { Pressable, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
}

export function Checkbox({ checked, onToggle, label }: CheckboxProps) {
  return (
    <Pressable onPress={onToggle} className="flex-row items-center">
      <View
        className={`mr-2 h-[18px] w-[18px] items-center justify-center rounded border ${
          checked ? 'border-primary bg-primary' : 'border-border bg-white'
        }`}
      >
        {checked ? <Text className="text-[10px] font-bold text-white">✓</Text> : null}
      </View>
      <Text className="text-sm text-text-muted">{label}</Text>
    </Pressable>
  );
}
