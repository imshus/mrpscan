import { Pressable, Text, TextInput, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import { ErrorText } from './ErrorText';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  visible: boolean;
  onToggleVisible: () => void;
}

export function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  visible,
  onToggleVisible,
}: PasswordFieldProps) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-xs text-text-muted">{label}</Text>
      <View
        className={`min-h-[52px] flex-row items-center rounded-input border border-border bg-white px-4 ${error ? 'border-danger-text' : ''}`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          secureTextEntry={!visible}
          autoCapitalize="none"
          className="flex-1 text-base text-text-primary"
        />
        <Pressable onPress={onToggleVisible} hitSlop={8}>
          {visible ? (
            <Eye size={20} color={Colors.textMuted} />
          ) : (
            <EyeOff size={20} color={Colors.textMuted} />
          )}
        </Pressable>
      </View>
      <ErrorText message={error} />
    </View>
  );
}
