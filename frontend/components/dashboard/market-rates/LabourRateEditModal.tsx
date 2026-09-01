import { useState } from 'react';
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
import { ChevronDown, X } from 'lucide-react-native';

import { screenStyles } from '@/constants/screenLayout';
import { LABOUR_WEIGHT_OPTIONS, type LabourWeightBasis } from '@/constants/labour';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { LabourRateFormErrors } from '@/utils/labourRateUtils';
import { labourWeightBasisLabel } from '@/utils/labourRateUtils';

const BUTTON_GREEN = '#A81F17';

interface LabourRateEditModalProps {
  visible: boolean;
  amount: string;
  weightBasis: LabourWeightBasis;
  errors: LabourRateFormErrors;
  saving?: boolean;
  onAmountChange: (value: string) => void;
  onWeightBasisChange: (value: LabourWeightBasis) => void;
  onClose: () => void;
  onSave: () => void;
}

export function LabourRateEditModal({
  visible,
  amount,
  weightBasis,
  errors,
  saving = false,
  onAmountChange,
  onWeightBasisChange,
  onClose,
  onSave,
}: LabourRateEditModalProps) {
  const [basisDropdownOpen, setBasisDropdownOpen] = useState(false);

  const closeAndReset = () => {
    setBasisDropdownOpen(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeAndReset}>
      <View style={screenStyles.modalOverlay}>
        <View style={screenStyles.modalCard}>
          <Pressable onPress={closeAndReset} hitSlop={8} style={styles.modalClose}>
            <X size={20} color={Colors.textSecondary} />
          </Pressable>

          <Text style={styles.modalTitle}>Labour Rates</Text>

          <View style={styles.fieldRow}>
            <View style={[styles.amountRow, { flex: 1.4 }]}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                value={amount}
                onChangeText={(text) => onAmountChange(text.replace(/[^\d.]/g, ''))}
                placeholder="Enter amount"
                placeholderTextColor={Colors.placeholder}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>

            <View style={{ flex: 1, minWidth: 112 }}>
              <Pressable
                onPress={() => setBasisDropdownOpen((open) => !open)}
                style={styles.unitDropdown}
              >
                <Text style={styles.unitDropdownText} numberOfLines={1}>
                  {labourWeightBasisLabel(weightBasis)}
                </Text>
                <ChevronDown size={16} color="#857A63" />
              </Pressable>
              {basisDropdownOpen ? (
                <View style={styles.unitDropdownList}>
                  {LABOUR_WEIGHT_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        onWeightBasisChange(option.value);
                        setBasisDropdownOpen(false);
                      }}
                      style={[
                        styles.unitOption,
                        option.value === weightBasis && styles.unitOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.unitOptionText,
                          option.value === weightBasis && styles.unitOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}

          <View style={styles.modalActions}>
            <Pressable onPress={closeAndReset} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={onSave}
              disabled={saving}
              style={[styles.applyBtn, saving && styles.applyBtnDisabled]}
            >
              {saving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.applyBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalClose: { alignSelf: 'flex-end' },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    // Keeps the open list above the buttons instead of behind them.
    zIndex: 10,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: Spacing.md,
    height: 46,
  },
  unitDropdown: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: Spacing.sm,
  },
  unitDropdownText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  unitDropdownList: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 50,
    zIndex: 20,
    overflow: 'hidden',
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unitOption: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
    backgroundColor: Colors.white,
  },
  unitOptionSelected: {
    backgroundColor: 'rgba(27, 48, 34, 0.1)',
  },
  unitOptionText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  unitOptionTextSelected: {
    fontWeight: '600',
    color: BUTTON_GREEN,
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
    marginRight: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  errorText: {
    marginTop: Spacing.xs,
    fontSize: 12,
    color: Colors.dangerText,
    lineHeight: 16,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  cancelBtn: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  applyBtn: {
    flex: 1,
    height: Spacing.buttonHeight,
    backgroundColor: BUTTON_GREEN,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnDisabled: { opacity: 0.7 },
  applyBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },
});
