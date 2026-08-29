import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { Colors } from '@/constants/theme';

export type SearchableSelectOption = {
  value: string;
  label?: string;
};

interface SearchableSelectDropdownProps {
  label?: string;
  value: string;
  options: readonly SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  containerClassName?: string;
  allowClear?: boolean;
  /** Mockup `.metal-field select` trigger: h38, radius 9, white bg, 12.8px text, 14px chevron. */
  compact?: boolean;
}

export function SearchableSelectDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  searchPlaceholder = 'Search',
  containerClassName = 'flex-1',
  allowClear = false,
  compact = false,
}: SearchableSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { height } = useWindowDimensions();

  const hasValue = value.trim().length > 0;

  const selectedLabel = useMemo(() => {
    const match = options.find((option) => option.value === value);
    return match?.label ?? match?.value ?? value;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => {
      const optionLabel = option.label ?? option.value;
      return (
        option.value.toLowerCase().includes(query) ||
        optionLabel.toLowerCase().includes(query)
      );
    });
  }, [options, search]);

  const closeMenu = () => {
    setOpen(false);
    setSearch('');
  };

  const maxMenuHeight = Math.min(height * 0.62, 380);

  return (
    <View className={containerClassName}>
      {label ? (
        <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-label">
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setOpen((current) => !current)}
        className={
          compact
            ? `h-[38px] flex-row items-center justify-between rounded-[9px] border bg-white px-[9px] ${
                open ? 'border-primary' : 'border-border'
              }`
            : `h-11 flex-row items-center justify-between rounded-input border px-3.5 ${
                open ? 'border-primary bg-white' : 'border-border bg-surface-input'
              }`
        }
      >
        <Text
          className={`flex-1 ${compact ? 'text-[12.8px]' : 'text-sm'} ${
            hasValue ? 'text-text-primary' : 'text-text-placeholder'
          }`}
          numberOfLines={1}
        >
          {hasValue ? selectedLabel : placeholder}
        </Text>
        <ChevronDown
          size={compact ? 14 : 16}
          color="#857A63"
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={closeMenu}>
        <View className="flex-1 justify-end bg-black/35">
          <Pressable className="absolute inset-0" onPress={closeMenu} />

          <View className="rounded-t-[28px] bg-white px-4 pb-4 pt-3 shadow-lg">
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-border" />
            {label ? <Text className="mb-3 text-base font-bold text-text-primary">{label}</Text> : null}

            <View className="mb-3 h-11 flex-row items-center rounded-input border border-border bg-surface-input px-3.5">
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder}
                placeholderTextColor={Colors.placeholder}
                autoCorrect={false}
                autoCapitalize="none"
                className="flex-1 text-sm text-text-primary"
              />
            </View>

            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              persistentScrollbar
              style={{ maxHeight: maxMenuHeight }}
              ListHeaderComponent={
                allowClear ? (
                  <Pressable
                    onPress={() => {
                      onChange('');
                      closeMenu();
                    }}
                    className="rounded-input px-3.5 py-3"
                  >
                    <Text className="text-sm text-text-secondary">None</Text>
                  </Pressable>
                ) : null
              }
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      closeMenu();
                    }}
                    className={`rounded-input px-3.5 py-3 ${isSelected ? 'bg-surface-muted' : ''}`}
                  >
                    <Text
                      className={`text-sm ${
                        isSelected ? 'font-semibold text-primary' : 'text-text-secondary'
                      }`}
                    >
                      {item.label ?? item.value}
                    </Text>
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View className="h-2" />}
              ListEmptyComponent={
                <Text className="px-3.5 py-3 text-sm text-text-muted">No results found.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}