import {
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import type { ComponentProps } from 'react';

import { FieldLabel } from '@/components/scanner/FieldLabel';
import { Colors } from '@/constants/theme';

interface FormInputProps {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  required?: boolean;
  containerClassName?: string;
  keyboardType?: KeyboardTypeOptions;
  onFocus?: ComponentProps<typeof TextInput>['onFocus'];
  onBlur?: ComponentProps<typeof TextInput>['onBlur'];
}

export function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  required = false,
  containerClassName = 'mb-3',
  keyboardType,
  onFocus,
  onBlur,
}: FormInputProps) {
  return (
    <View className={containerClassName}>
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={editable}
        showSoftInputOnFocus={editable}
        selectTextOnFocus={editable}
        caretHidden={!editable}
        contextMenuHidden={!editable}
        placeholderTextColor={Colors.placeholder}
        keyboardType={keyboardType}
        onFocus={onFocus}
        onBlur={onBlur}
        className="h-11 rounded-input border border-border bg-surface-input px-3.5 text-sm text-text-primary"
      />
    </View>
  );
}
