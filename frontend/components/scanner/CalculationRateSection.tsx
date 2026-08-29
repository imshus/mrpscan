import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { FormSection } from '@/components/scanner/FormSection';
import { Colors } from '@/constants/theme';

export type CalculationRateMode = 'rtgs' | 'cash';
export type CalculationRateAccess = 'rtgs' | 'cash' | 'both';

const RATE_OPTIONS: { value: CalculationRateMode; label: string }[] = [
  { value: 'rtgs', label: 'RTGS Rate' },
  { value: 'cash', label: 'Cash Rate' },
];

interface CalculationRateSectionProps {
  value: CalculationRateMode;
  onChange: (value: CalculationRateMode) => void;
  access?: CalculationRateAccess;
}

export function CalculationRateSection({
  value,
  onChange,
  access = 'both',
}: CalculationRateSectionProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = RATE_OPTIONS.find((option) => option.value === value)?.label ?? 'RTGS Rate';
  const fixedLabel = access === 'cash' ? 'Cash Rate' : 'RTGS Rate';

  return (
    <FormSection title="Calculation Rate">
      {access === 'both' ? (
        <>
          <Pressable
            onPress={() => setOpen((prev) => !prev)}
            className="h-11 flex-row items-center justify-between rounded-input border border-border bg-surface-input px-3.5"
          >
            <Text className="text-sm text-text-primary">{selectedLabel}</Text>
            <ChevronDown size={18} color={Colors.textMuted} />
          </Pressable>

          {open ? (
            <View className="mt-2 overflow-hidden rounded-input border border-border bg-white">
              {RATE_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`px-3.5 py-3 ${value === option.value ? 'bg-primary/10' : 'bg-white'}`}
                >
                  <Text
                    className={`text-sm ${value === option.value ? 'font-semibold text-primary' : 'text-text-primary'}`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <View className="h-11 justify-center rounded-input border border-border bg-surface-input px-3.5">
          <Text className="text-sm text-text-primary">{fixedLabel}</Text>
        </View>
      )}
    </FormSection>
  );
}
