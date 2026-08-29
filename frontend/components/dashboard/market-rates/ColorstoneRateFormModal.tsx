import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { StoneOptionSelect } from '@/components/dashboard/market-rates/StoneOptionSelect';
import type { StoneSelectOption } from '@/constants/stoneRateOptions';
import { Colors, Radius } from '@/constants/theme';

interface ColorstoneRateFormModalProps {
  visible: boolean;
  isNew: boolean;
  color: string;
  clarity: string;
  rateValue: string;
  errors: { color?: string; clarity?: string; rate?: string };
  saving?: boolean;
  colorOptions: readonly StoneSelectOption[];
  clarityOptions: readonly StoneSelectOption[];
  onColorChange: (value: string) => void;
  onClarityChange: (value: string) => void;
  onRateChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onAddCustomColor?: (value: string) => void;
  onAddCustomClarity?: (value: string) => void;
  validateCustomValue?: (value: string, type: 'color' | 'clarity') => string | null;
}

export function ColorstoneRateFormModal({
  visible,
  isNew,
  color,
  clarity,
  rateValue,
  errors,
  saving = false,
  colorOptions,
  clarityOptions,
  onColorChange,
  onClarityChange,
  onRateChange,
  onClose,
  onSave,
  onAddCustomColor,
  onAddCustomClarity,
  validateCustomValue,
}: ColorstoneRateFormModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
            <X size={20} color={Colors.textSecondary} />
          </Pressable>
          <Text style={styles.title}>{isNew ? 'Add' : 'Edit'} Colorstone Rate</Text>
          <Text style={styles.hint}>
            Select Color only, Clarity only, or both. At least one is required.
          </Text>

          <StoneOptionSelect
            label="Color"
            value={color}
            options={colorOptions}
            onChange={onColorChange}
            placeholder="Select color"
            error={errors.color}
            allowCustom
            customLabel="Custom Color"
            customInputLabel="Enter Color"
            customPlaceholder="e.g. AB"
            onAddCustom={onAddCustomColor}
            normalizeCustomValue={(input) => input.trim()}
            validateCustomValue={(value) => validateCustomValue?.(value, 'color') ?? null}
            customAutoCapitalize="none"
          />
          <StoneOptionSelect
            label="Clarity"
            value={clarity}
            options={clarityOptions}
            onChange={onClarityChange}
            placeholder="Select clarity"
            error={errors.clarity}
            allowCustom
            customLabel="Custom Clarity"
            customInputLabel="Enter Clarity"
            customPlaceholder="e.g. IF"
            onAddCustom={onAddCustomClarity}
            normalizeCustomValue={(input) => input.trim()}
            validateCustomValue={(value) => validateCustomValue?.(value, 'clarity') ?? null}
            customAutoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Rate (₹)</Text>
          <TextInput
            value={rateValue}
            onChangeText={onRateChange}
            keyboardType="decimal-pad"
            placeholder="5000"
            placeholderTextColor={Colors.placeholder}
            style={[styles.input, errors.rate ? styles.inputError : null]}
          />
          {errors.rate ? <Text style={styles.error}>{errors.rate}</Text> : null}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={onSave}
              disabled={saving}
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            >
              {saving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.input,
    padding: 20,
  },
  close: { alignSelf: 'flex-end' },
  title: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  hint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  inputError: { borderColor: '#D9291F' },
  error: { fontSize: 12, color: '#D9291F', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#A81F17',
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveText: { fontSize: 15, fontWeight: '600', color: Colors.white },
});
