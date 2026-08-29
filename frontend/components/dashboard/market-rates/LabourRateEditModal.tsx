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
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { LabourRateFormErrors } from '@/utils/labourRateUtils';

const BUTTON_GREEN = '#A81F17';

interface LabourRateEditModalProps {
  visible: boolean;
  amount: string;
  percentage: string;
  amountDisabled: boolean;
  percentageDisabled: boolean;
  errors: LabourRateFormErrors;
  rupeesUnit: 'Per Gram' | 'Per 10 Gram';
  saving?: boolean;
  onAmountChange: (value: string) => void;
  onPercentageChange: (value: string) => void;
  onRupeesUnitChange: (value: 'Per Gram' | 'Per 10 Gram') => void;
  onClose: () => void;
  onSave: () => void;
}

function OrDivider() {
  return (
    <View style={styles.orRow}>
      <View style={styles.orLine} />
      <Text style={styles.orText}>OR</Text>
      <View style={styles.orLine} />
    </View>
  );
}

export function LabourRateEditModal({
  visible,
  amount,
  percentage,
  amountDisabled,
  percentageDisabled,
  errors,
  rupeesUnit,
  saving = false,
  onAmountChange,
  onPercentageChange,
  onRupeesUnitChange,
  onClose,
  onSave,
}: LabourRateEditModalProps) {
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={screenStyles.modalOverlay}>
        <View style={screenStyles.modalCard}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.modalClose}>
            <X size={20} color={Colors.textSecondary} />
          </Pressable>

          <Text style={styles.modalTitle}>Edit Labour Rates</Text>
          <Text style={styles.modalHint}>Fill only one field — amount or gold purity %.</Text>

          <View style={[styles.fieldCard, percentageDisabled && styles.fieldDisabled]}>
            <Text style={styles.caseTitle}>Case I — % Purity Mode</Text>
            <Text style={styles.caseHint}>Custom % overrides pure wt; labour charge prints as ₹0</Text>
            <View style={styles.amountRow}>
              <TextInput
                value={percentage}
                onChangeText={(text) => onPercentageChange(text.replace(/[^\d.]/g, ''))}
                placeholder="Enter %"
                editable={!percentageDisabled}
                placeholderTextColor={Colors.placeholder}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            {errors.percentage ? <Text style={styles.errorText}>{errors.percentage}</Text> : null}
          </View>

          <OrDivider />

          <View style={[styles.fieldCard, amountDisabled && styles.fieldDisabled]}>
            <Text style={styles.caseTitle}>Case II — Fixed Amount Mode</Text>
            <Text style={styles.caseHint}>Labour = Net wt (gms) × rate per gram</Text>
            <View style={styles.amountRowWrapper}>
              <View style={[styles.amountRow, { flex: 1.5 }]}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  value={amount}
                  onChangeText={(text) => onAmountChange(text.replace(/[^\d.]/g, ''))}
                  placeholder="Enter amount"
                  editable={!amountDisabled}
                  placeholderTextColor={Colors.placeholder}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1, minWidth: 110 }}>
                <Pressable
                  onPress={() => !amountDisabled && setUnitDropdownOpen((v) => !v)}
                  disabled={amountDisabled}
                  style={styles.unitDropdown}
                >
                  <Text style={styles.unitDropdownText} numberOfLines={1}>
                    {rupeesUnit}
                  </Text>
                  <ChevronDown size={16} color="#857A63" />
                </Pressable>
                {unitDropdownOpen && !amountDisabled ? (
                  <View style={styles.unitDropdownList}>
                    {['Per Gram', 'Per 10 Gram'].map((option) => (
                      <Pressable
                        key={option}
                        onPress={() => {
                          onRupeesUnitChange(option as 'Per Gram' | 'Per 10 Gram');
                          setUnitDropdownOpen(false);
                        }}
                        style={[
                          styles.unitOption,
                          option === rupeesUnit && styles.unitOptionSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.unitOptionText,
                            option === rupeesUnit && styles.unitOptionTextSelected,
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
            {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}
          </View>

          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
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
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  modalHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  fieldCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    padding: Spacing.md,
    backgroundColor: Colors.white,
  },
  fieldDisabled: { opacity: 0.45 },
  caseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  caseHint: {
    fontSize: 10,
    lineHeight: 16,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  amountRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    zIndex: 10, // Ensure dropdown flows over below items
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  unitDropdown: {
    height: 44,
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
    fontSize: 13,
    color: Colors.textPrimary,
  },
  unitDropdownList: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 48,
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
    fontSize: 13,
    color: Colors.textPrimary,
  },
  unitOptionTextSelected: {
    fontWeight: '600',
    color: BUTTON_GREEN,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    marginRight: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  errorText: {
    marginTop: Spacing.xs,
    fontSize: 12,
    color: Colors.dangerText,
    lineHeight: 16,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  orLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  orText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
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
