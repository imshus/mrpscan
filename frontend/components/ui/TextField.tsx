import { Text, TextInput, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { ErrorText } from './ErrorText';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  editable?: boolean;
  rightElement?: React.ReactNode;
  className?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  autoCapitalize = 'none',
  keyboardType = 'default',
  editable = true,
  rightElement,
  className = '',
}: TextFieldProps) {
  return (
    <View className={`mb-4 ${className}`}>
      <Text className="mb-2 text-xs text-text-muted">{label}</Text>
      <View
        className={`min-h-[52px] flex-row items-center rounded-input border border-border bg-white px-4 ${!editable ? 'bg-surface-card' : ''} ${error ? 'border-danger-text' : ''}`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          editable={editable}
          className="min-w-0 flex-1 text-base text-text-primary"
        />
        {rightElement}
      </View>
      <ErrorText message={error} />
    </View>
  );
}
