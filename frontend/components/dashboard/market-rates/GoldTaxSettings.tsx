import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronDown, ChevronRight, Pencil, Settings2, X } from 'lucide-react-native';

import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatMcxLiveRate, formatTaxChange } from '@/utils/goldRateUtils';
import { formatInr } from '@/utils/rateMappers';

const BUTTON_GREEN = '#A81F17';

export type ScannerCalculationUse = 'rtgs' | 'cash';
export type TaxChangeTarget = 'rtgs' | 'cash';
type TaxChangeDirection = 'increase' | 'decrease';

const SCANNER_OPTIONS: { value: ScannerCalculationUse; label: string }[] = [
  { value: 'rtgs', label: 'RTGS Rate' },
  { value: 'cash', label: 'Cash Rate' },
];

interface GoldTaxSettingsRowProps {
  onPress: () => void;
}

export function GoldTaxSettingsRow({ onPress }: GoldTaxSettingsRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.settingsRow}>
      <View style={styles.settingsRowLeft}>
        <Settings2 size={18} color={BUTTON_GREEN} />
        <Text style={styles.settingsRowText}>Gold Rate Settings</Text>
      </View>
      <ChevronRight size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

interface ScannerCalculationPickerProps {
  value: ScannerCalculationUse;
  onChange: (value: ScannerCalculationUse) => void;
}

export function ScannerCalculationPicker({ value, onChange }: ScannerCalculationPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = SCANNER_OPTIONS.find((opt) => opt.value === value)?.label ?? 'RTGS Rate';

  return (
    <View style={styles.scannerSection}>
      <Text style={styles.scannerLabel}>For Scanner Calculation Use</Text>
      <Pressable onPress={() => setOpen((prev) => !prev)} style={styles.scannerDropdown}>
        <Text style={styles.scannerDropdownText}>{selectedLabel}</Text>
        <ChevronDown size={18} color={Colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.scannerOptions}>
          {SCANNER_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={[
                styles.scannerOption,
                value === option.value && styles.scannerOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.scannerOptionText,
                  value === option.value && styles.scannerOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface RateSettingsCardProps {
  title: string;
  showMcxLive?: boolean;
  mcxLiveRate?: number;
  changeValue: number;
  finalRate: number;
  onEdit: () => void;
}

function RateSettingsCard({
  title,
  showMcxLive,
  mcxLiveRate,
  changeValue,
  finalRate,
  onEdit,
}: RateSettingsCardProps) {
  return (
    <View style={styles.rateCard}>
      <Text style={styles.rateCardTitle}>{title}</Text>
      {showMcxLive && mcxLiveRate != null ? (
        <View style={styles.mcxMiniBanner}>
          <Text style={styles.mcxMiniLabel}>24K Live MCX Rate</Text>
          <Text style={styles.mcxMiniValue}>{formatMcxLiveRate(mcxLiveRate)}</Text>
        </View>
      ) : null}
      <View style={styles.changeRow}>
        <View style={styles.changeInfo}>
          <Text style={styles.changeLabel}>Change By</Text>
          <Text style={styles.changeValue}>{formatTaxChange(changeValue)}</Text>
        </View>
        <Pressable onPress={onEdit} style={styles.editBtn}>
          <Pencil size={14} color={Colors.white} />
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
      </View>
      <View style={styles.finalRow}>
        <Text style={styles.finalLabel}>Final Rate</Text>
        <Text style={styles.finalValue}>{formatInr(finalRate)}</Text>
      </View>
    </View>
  );
}

interface GoldTaxSettingsModalProps {
  visible: boolean;
  mcxLiveRate: number;
  rtgsChange: number;
  cashChange: number;
  rtgsFinalRate: number;
  cashFinalRate: number;
  onClose: () => void;
  onEditRtgs: () => void;
  onEditCash: () => void;
}

export function GoldTaxSettingsModal({
  visible,
  mcxLiveRate,
  rtgsChange,
  cashChange,
  rtgsFinalRate,
  cashFinalRate,
  onClose,
  onEditRtgs,
  onEditCash,
}: GoldTaxSettingsModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={screenStyles.modalOverlay}>
        <View style={[screenStyles.modalCard, styles.settingsModalCard]}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.modalClose}>
            <X size={20} color={Colors.textSecondary} />
          </Pressable>
          <Text style={styles.modalTitle}>Gold Rate Settings</Text>
          <RateSettingsCard
            title="RTGS With Tax Rate"
            showMcxLive
            mcxLiveRate={mcxLiveRate}
            changeValue={rtgsChange}
            finalRate={rtgsFinalRate}
            onEdit={onEditRtgs}
          />
          <RateSettingsCard
            title="Cash Without Tax Rate"
            changeValue={cashChange}
            finalRate={cashFinalRate}
            onEdit={onEditCash}
          />
          <Pressable onPress={onClose} style={styles.doneBtn}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface GoldTaxChangeEditModalProps {
  visible: boolean;
  target: TaxChangeTarget | null;
  currentChange: number;
  onClose: () => void;
  onApply: (change: number) => void;
}

export function GoldTaxChangeEditModal({
  visible,
  target,
  currentChange,
  onClose,
  onApply,
}: GoldTaxChangeEditModalProps) {
  const [direction, setDirection] = useState<TaxChangeDirection>(
    currentChange < 0 ? 'decrease' : 'increase',
  );
  const [amount, setAmount] = useState(currentChange ? String(Math.abs(currentChange)) : '');
  const [directionOpen, setDirectionOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setDirection(currentChange < 0 ? 'decrease' : 'increase');
      setAmount(currentChange ? String(Math.abs(currentChange)) : '');
      setDirectionOpen(false);
    }
  }, [visible, currentChange, target]);

  const resetForm = () => {
    setDirection(currentChange < 0 ? 'decrease' : 'increase');
    setAmount(currentChange ? String(Math.abs(currentChange)) : '');
    setDirectionOpen(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleApply = () => {
    const parsed = Number(amount.replace(/[^\d.]/g, ''));
    const safeAmount = Number.isFinite(parsed) ? parsed : 0;
    const signedChange = direction === 'decrease' ? -safeAmount : safeAmount;
    onApply(signedChange);
    handleClose();
  };

  const directionLabel = direction === 'increase' ? 'Increase By (+)' : 'Decrease By (-)';
  const targetLabel = target === 'cash' ? 'Cash Rate' : 'RTGS Rate';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={screenStyles.modalOverlay}>
        <View style={screenStyles.modalCard}>
          <Pressable onPress={handleClose} hitSlop={8} style={styles.modalClose}>
            <X size={20} color={Colors.textSecondary} />
          </Pressable>
          <Text style={styles.modalTitle}>Edit {targetLabel} Change</Text>
          <Text style={styles.fieldLabel}>Operator</Text>
          <Pressable onPress={() => setDirectionOpen((prev) => !prev)} style={styles.operatorDropdown}>
            <Text style={styles.operatorDropdownText}>{directionLabel}</Text>
            <ChevronDown size={18} color={Colors.textMuted} />
          </Pressable>
          {directionOpen ? (
            <View style={styles.operatorOptions}>
              {(['increase', 'decrease'] as TaxChangeDirection[]).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => {
                    setDirection(opt);
                    setDirectionOpen(false);
                  }}
                  style={[styles.operatorOption, direction === opt && styles.operatorOptionActive]}
                >
                  <Text
                    style={[
                      styles.operatorOptionText,
                      direction === opt && styles.operatorOptionTextActive,
                    ]}
                  >
                    {opt === 'increase' ? 'Increase By (+)' : 'Decrease By (-)'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={styles.fieldLabel}>Amount (₹)</Text>
          <TextInput
            value={amount}
            onChangeText={(value) => setAmount(value.replace(/[^\d.]/g, ''))}
            keyboardType="number-pad"
            accessibilityLabel="Amount (₹)"
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Pressable onPress={handleClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <TouchableOpacity activeOpacity={0.9} onPress={handleApply} style={styles.applyBtn}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
  },
  settingsRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  settingsRowText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  scannerSection: { gap: Spacing.sm },
  scannerLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  scannerDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
  },
  scannerDropdownText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  scannerOptions: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  scannerOption: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  scannerOptionActive: { backgroundColor: '#F4ECDC' },
  scannerOptionText: { fontSize: 14, color: Colors.textPrimary },
  scannerOptionTextActive: { fontWeight: '700', color: BUTTON_GREEN },
  settingsModalCard: { maxHeight: '90%' },
  modalClose: { alignSelf: 'flex-end' },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  rateCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.white,
    gap: Spacing.md,
  },
  rateCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  mcxMiniBanner: {
    backgroundColor: '#FBF7F0',
    borderRadius: Radius.input,
    padding: Spacing.md,
    gap: 4,
  },
  mcxMiniLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  mcxMiniValue: { fontSize: 16, fontWeight: '700', color: BUTTON_GREEN },
  changeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  changeInfo: { gap: 4 },
  changeLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  changeValue: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BUTTON_GREEN,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editBtnText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  finalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    gap: 4,
  },
  finalLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  finalValue: { fontSize: 20, fontWeight: '700', color: BUTTON_GREEN },
  doneBtn: {
    height: Spacing.buttonHeight,
    backgroundColor: BUTTON_GREEN,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  doneBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  operatorDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 14,
  },
  operatorDropdownText: { fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  operatorOptions: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  operatorOption: { paddingHorizontal: 14, paddingVertical: 12 },
  operatorOptionActive: { backgroundColor: '#F4ECDC' },
  operatorOptionText: { fontSize: 14, color: Colors.textPrimary },
  operatorOptionTextActive: { fontWeight: '700', color: BUTTON_GREEN },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 14,
    fontSize: 16,
    color: Colors.textPrimary,
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
  applyBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },
});
