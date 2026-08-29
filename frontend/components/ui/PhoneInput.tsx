import { Text, TextInput, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import { ErrorText } from './ErrorText';

interface PhoneInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  editable?: boolean;
}

export function PhoneInput({
  label,
  value,
  onChangeText,
  placeholder = '9876543210',
  error,
  editable = true,
}: PhoneInputProps) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-xs text-text-muted">{label}</Text>
      <View
        className={`min-h-[52px] flex-row items-center rounded-input border border-border bg-white ${error ? 'border-danger-text' : ''}`}
      >
        <View className="flex-row items-center border-r border-border px-3">
          <Text className="text-base text-text-primary">+91</Text>
          <ChevronDown size={14} color={Colors.textMuted} style={{ marginLeft: 4 }} />
        </View>
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 10))}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          keyboardType="phone-pad"
          editable={editable}
          className="min-w-0 flex-1 px-3 text-base text-text-primary"
        />
      </View>
      <ErrorText message={error} />
    </View>
  );
}
