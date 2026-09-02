import {
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import type { ComponentProps } from 'react';

import { FieldLabel } from '@/components/scanner/FieldLabel';

interface FormInputProps {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
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
        accessibilityLabel={label}
        editable={editable}
        showSoftInputOnFocus={editable}
        selectTextOnFocus={editable}
        caretHidden={!editable}
        contextMenuHidden={!editable}
        keyboardType={keyboardType}
        onFocus={onFocus}
        onBlur={onBlur}
        className="h-11 rounded-input border border-border bg-surface-input px-3.5 text-sm text-text-primary"
      />
    </View>
  );
}
