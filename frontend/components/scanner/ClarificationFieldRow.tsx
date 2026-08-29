import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { getApiFieldLabel } from '@/utils/scanMappers';
import { Colors } from '@/constants/theme';
import { useScannerStore } from '@/store/scannerStore';
import type { ClarificationField } from '@/types/scanner';

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

interface ClarificationFieldRowProps {
  field: ClarificationField;
  mappedField: string;
  description?: string;
  onMappedFieldChange: (mappedField: string) => void;
  onDescriptionChange?: (description: string) => void;
}

export function ClarificationFieldRow({
  field,
  mappedField,
  description = '',
  onMappedFieldChange,
  onDescriptionChange,
}: ClarificationFieldRowProps) {
  const selectedType = useScannerStore((s) => s.selectedType);
  const rowRef = useRef<View>(null);
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const toggleDropdown = () => {
    if (open) {
      setOpen(false);
      return;
    }

    if (!rowRef.current || !triggerRef.current) {
      setOpen(true);
      return;
    }

    triggerRef.current.measureLayout(
      rowRef.current,
      (x, y, width, height) => {
        setMenuPosition({ top: y + height, left: x, width });
        setOpen(true);
      },
      () => setOpen(true),
    );
  };

  return (
    <View
      ref={rowRef}
      className="relative mb-4 rounded-2xl border border-border bg-white p-4"
      style={{ overflow: 'visible' }}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text-primary">{field.abbreviation}</Text>
        <Text className="text-xs text-text-muted">{field.confidence}% confidence</Text>
      </View>

      <Text className="mb-3 text-xs text-text-secondary">
        Detected value: <Text className="font-medium text-text-primary">{field.detectedValue}</Text>
      </Text>

      <View className="flex-row items-center gap-2">
        <View ref={triggerRef} className="h-[46px] flex-1 flex-row overflow-hidden rounded-input border border-border bg-white">
          <Pressable className="flex-1 justify-center px-3" onPress={toggleDropdown}>
            <Text className="text-sm font-medium text-text-primary">
              {getApiFieldLabel(mappedField, selectedType)}
            </Text>
          </Pressable>
          <Pressable className="w-11 items-center justify-center bg-primary" onPress={toggleDropdown}>
            <ChevronDown
              size={18}
              color="#FFFFFF"
              style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
            />
          </Pressable>
        </View>
      </View>

      {mappedField === 'other' ? (
        <TextInput
          value={description}
          onChangeText={onDescriptionChange}
          placeholder="Describe this field (e.g. Colored Stone Weight)"
          placeholderTextColor={Colors.placeholder}
          className="mt-3 rounded-input border border-border px-3 py-2.5 text-sm text-text-primary"
        />
      ) : null}

      {open && menuPosition ? (
        <View
          className="absolute overflow-hidden rounded-b-input border border-border bg-white shadow-lg"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            zIndex: 100,
            elevation: 12,
          }}
        >
          {field.availableFields.map((option, index) => {
            const isSelected = mappedField === option;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  onMappedFieldChange(option);
                  setOpen(false);
                }}
                className={`px-3 py-3 ${index > 0 ? 'border-t border-border' : ''} ${
                  isSelected ? 'bg-primary' : 'bg-white'
                }`}
              >
                <Text
                  className={`text-sm ${
                    isSelected ? 'font-semibold text-white' : 'text-text-primary'
                  }`}
                >
                  {getApiFieldLabel(option, selectedType)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
