import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { ChevronDown, Plus } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';
import type { StoneSelectOption } from '@/constants/stoneRateOptions';

interface StoneOptionSelectProps {
  label: string;
  value: string;
  options: readonly StoneSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  error?: string;
  allowCustom?: boolean;
  customLabel?: string;
  customInputLabel?: string;
  customPlaceholder?: string;
  onAddCustom?: (value: string) => void;
  normalizeCustomValue?: (value: string) => string;
  validateCustomValue?: (value: string) => string | null;
  customAutoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function StoneOptionSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  allowClear = true,
  error,
  allowCustom = false,
  customLabel = 'Add Custom',
  customInputLabel,
  customPlaceholder = 'Enter value',
  onAddCustom,
  normalizeCustomValue = (input) => input.trim(),
  validateCustomValue,
  customAutoCapitalize = 'characters',
}: StoneOptionSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const { height } = useWindowDimensions();

  const selectedLabel = useMemo(() => {
    const match = options.find((option) => option.value === value);
    return match?.label ?? value;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => {
      const labelText = option.label ?? option.value;
      return (
        option.value.toLowerCase().includes(query) ||
        labelText.toLowerCase().includes(query)
      );
    });
  }, [options, search]);

  const closeMenu = () => {
    setOpen(false);
    setSearch('');
  };

  const openCustomDialog = () => {
    setCustomValue('');
    setCustomError(null);
    setCustomOpen(true);
  };

  const handleCustomSave = () => {
    const normalized = normalizeCustomValue(customValue);
    if (!normalized) {
      setCustomError('Value is required.');
      return;
    }
    const validationError = validateCustomValue?.(normalized) ?? null;
    if (validationError) {
      setCustomError(validationError);
      return;
    }
    onAddCustom?.(normalized);
    onChange(normalized);
    setCustomOpen(false);
    closeMenu();
  };

  const maxMenuHeight = Math.min(height * 0.6, 360);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        style={[styles.trigger, error ? styles.triggerError : null]}
      >
        <Text style={[styles.triggerText, !value && styles.placeholder]}>
          {value ? selectedLabel : placeholder}
        </Text>
        <ChevronDown size={16} color={Colors.textMuted} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeMenu}>
          <Pressable style={[styles.sheetCard, { maxHeight: maxMenuHeight }]}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <View style={styles.searchWrap}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search"
                placeholderTextColor={Colors.placeholder}
                style={styles.searchInput}
              />
            </View>
            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator
              persistentScrollbar
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    closeMenu();
                  }}
                  style={[styles.menuItem, value === item.value && styles.menuItemActive]}
                >
                  <Text
                    style={[
                      styles.menuItemText,
                      value === item.value && styles.menuItemTextActive,
                    ]}
                  >
                    {item.label ?? item.value}
                  </Text>
                </Pressable>
              )}
              ListHeaderComponent={
                allowClear ? (
                  <Pressable
                    onPress={() => {
                      onChange('');
                      closeMenu();
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={styles.menuItemMuted}>None</Text>
                  </Pressable>
                ) : null
              }
              ListFooterComponent={
                allowCustom ? (
                  <Pressable onPress={openCustomDialog} style={styles.customItem}>
                    <Plus size={14} color={Colors.textPrimary} />
                    <Text style={styles.customText}>{customLabel}</Text>
                  </Pressable>
                ) : null
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={customOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomOpen(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>{customInputLabel ?? customLabel}</Text>
            <TextInput
              value={customValue}
              onChangeText={(text) => {
                setCustomValue(text);
                if (customError) setCustomError(null);
              }}
              placeholder={customPlaceholder}
              placeholderTextColor={Colors.placeholder}
              autoCapitalize={customAutoCapitalize}
              style={[styles.dialogInput, customError ? styles.dialogInputError : null]}
            />
            {customError ? <Text style={styles.error}>{customError}</Text> : null}
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setCustomOpen(false)}
                style={styles.dialogCancelBtn}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCustomSave} style={styles.dialogSaveBtn}>
                <Text style={styles.dialogSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  trigger: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
  },
  triggerError: { borderColor: '#D9291F' },
  triggerText: { fontSize: 15, color: Colors.textPrimary },
  placeholder: { color: Colors.placeholder },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.input,
    borderTopRightRadius: Radius.input,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  searchWrap: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    height: 42,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12 },
  menuItemActive: { backgroundColor: '#F4ECDC' },
  menuItemText: { fontSize: 14, color: Colors.textPrimary },
  menuItemTextActive: { fontWeight: '700', color: '#A81F17' },
  menuItemMuted: { fontSize: 14, color: Colors.textMuted },
  customItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  customText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.input,
    padding: 20,
  },
  dialogTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  dialogInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  dialogInputError: { borderColor: '#D9291F' },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  dialogCancelBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  dialogSaveBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.button,
    backgroundColor: '#A81F17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogSaveText: { fontSize: 14, fontWeight: '600', color: Colors.white },
  error: { fontSize: 12, color: '#D9291F', marginTop: 4 },
});
