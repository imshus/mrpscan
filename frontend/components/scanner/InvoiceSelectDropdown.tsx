import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { FieldLabel } from '@/components/scanner/FieldLabel';

interface InvoiceSelectDropdownProps<T extends string | number> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  formatOption?: (value: T) => string;
  placeholder?: string;
  containerClassName?: string;
}

export function InvoiceSelectDropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
  formatOption = (option) => String(option),
  placeholder = 'Select',
  containerClassName = 'flex-1',
}: InvoiceSelectDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const hasValue = value !== '' && value !== undefined && value !== null;

  return (
    <View className={containerClassName}>
      {label ? <FieldLabel label={label} /> : null}
      <Pressable
        onPress={() => setOpen((current) => !current)}
        className={`h-11 flex-row items-center justify-between rounded-input border px-3.5 ${
          open ? 'border-primary bg-white' : 'border-border bg-surface-input'
        }`}
      >
        <Text
          className={`flex-1 text-sm ${hasValue ? 'text-text-primary' : 'text-text-placeholder'}`}
          numberOfLines={1}
        >
          {hasValue ? formatOption(value) : placeholder}
        </Text>
        <ChevronDown
          size={16}
          color="#857A63"
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        />
      </Pressable>

      {open ? (
        <View className="mt-1 overflow-hidden rounded-input border border-border bg-white">
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            persistentScrollbar
            style={{ maxHeight: 192 }}
          >
            {options.map((option, index) => {
              const isSelected = option === value;
              const isLast = index === options.length - 1;
              return (
                <Pressable
                  key={String(option)}
                  onPress={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={`px-3.5 py-3 ${isSelected ? 'bg-surface-muted' : 'bg-white'} ${
                    isLast ? '' : 'border-b border-border'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      isSelected ? 'font-semibold text-primary' : 'text-text-secondary'
                    }`}
                  >
                    {formatOption(option)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
