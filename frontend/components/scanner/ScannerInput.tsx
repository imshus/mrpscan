import { Text, TextInput, View } from 'react-native';

interface ScannerInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: (text: string) => void;
  disabled?: boolean;
}

export function ScannerInput({
  value,
  onChangeText,
  onSubmit,
  disabled = false,
}: ScannerInputProps) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-label">
        Scanner Tag
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={() => onSubmit?.(value)}
        editable={!disabled}
        accessibilityLabel="Scanner Tag"
        autoCapitalize="characters"
        autoCorrect={false}
        className="rounded-input border border-border bg-[#F4ECDC] px-4 py-3.5 font-mono text-base text-text-primary"
      />
      <Text className="mt-1.5 text-xs text-text-muted">
        Formats: RD|weight|rate (Diamond) · CS|weight|rate (Colorstone)
      </Text>
    </View>
  );
}
