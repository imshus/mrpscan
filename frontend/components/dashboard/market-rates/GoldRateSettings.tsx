import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronDown, ChevronRight, Settings2, X } from 'lucide-react-native';

import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatInr } from '@/utils/rateMappers';

const BUTTON_GREEN = '#A81F17';
const GOLD_ACTION_BAR_HEIGHT = 52;

type Sign = '+' | '-';
export type ScannerCalculationUse = 'rtgs' | 'cash';
export type TaxChangeTarget = 'rtgs' | 'cash';

const SCANNER_OPTIONS: { value: ScannerCalculationUse; label: string }[] = [
  { value: 'rtgs', label: 'RTGS Rate' },
  { value: 'cash', label: 'Cash Rate' },
];

interface GoldRateSettingsRowProps {
  onPress: () => void;
}

export function GoldRateSettingsRow({ onPress }: GoldRateSettingsRowProps) {
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

function SignToggle({ value, onChange }: { value: Sign; onChange: (next: Sign) => void }) {
  return (
    <View style={styles.signToggle}>
      <Pressable
        onPress={() => onChange('+')}
        style={[styles.signToggleBtn, value === '+' && styles.signToggleBtnActive]}
      >
        <Text style={[styles.signToggleText, value === '+' && styles.signToggleTextActive]}>+</Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('-')}
        style={[styles.signToggleBtn, value === '-' && styles.signToggleBtnActive]}
      >
        <Text style={[styles.signToggleText, value === '-' && styles.signToggleTextActive]}>-</Text>
      </Pressable>
    </View>
  );
}

function toSafeNumber(value: number | string | undefined | null, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function signedValue(sign: Sign, amount: string): number {
  const parsed = Number(amount || 0);
  const safeAmount = Number.isFinite(parsed) ? parsed : 0;
  return sign === '-' ? -safeAmount : safeAmount;
}

function getSignAndAmount(value: number): { sign: Sign; amount: string } {
  return {
    sign: value < 0 ? '-' : '+',
    amount: String(Math.abs(value)),
  };
}

function isSameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
}

interface RateCardProps {
  title: string;
  subtitle?: string;
  currentLabel?: string;
  finalLabel?: string;
  /** MCX shows its current rate; RTGS and Cash go straight to Change By. */
  showCurrentRate?: boolean;
  icon: React.ReactNode;
  sign: Sign;
  amount: string;
  currentRate: number;
  finalRate: number;
  formula: string;
  onSignChange: (next: Sign) => void;
  onAmountChange: (value: string) => void;
}

function RateCard({
  title,
  subtitle,
  currentLabel,
  finalLabel,
  showCurrentRate = true,
  icon,
  sign,
  amount,
  currentRate,
  finalRate,
  formula,
  onSignChange,
  onAmountChange,
}: RateCardProps) {
  return (
    <View style={styles.rateCard}>
      <View style={styles.rateCardHeader}>
        {icon ? <View style={styles.rateCardIconWrap}>{icon}</View> : null}
        <View style={styles.rateCardHeaderTextWrap}>
          <Text style={styles.rateCardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rateCardSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      {showCurrentRate ? (
        <View style={styles.currentRatePill}>
          <Text style={styles.currentRateLabel}>{currentLabel ?? title}</Text>
          <Text style={styles.currentRateValue}>{formatInr(currentRate)}</Text>
        </View>
      ) : null}

      <View style={styles.changeSection}>
        <Text style={styles.fieldLabel}>Change By</Text>
        <View style={styles.controlsRow}>
          <View style={styles.signToggleWrap}>
            <SignToggle value={sign} onChange={onSignChange} />
          </View>

          <View style={styles.amountInputWrap}>
            <Text style={styles.amountPrefix}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={(value) => onAmountChange(value.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder="Amount"
              placeholderTextColor={Colors.placeholder}
              style={styles.amountInput}
              maxLength={8}
            />
          </View>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.finalSection}>
        <Text style={styles.finalLabel}>{finalLabel ?? `Final ${title}`}</Text>
        <Text style={styles.finalValue}>{formatInr(finalRate)}</Text>
        {formula ? <Text style={styles.formulaText}>{formula}</Text> : null}
      </View>
    </View>
  );
}

interface GoldRateSettingsPanelProps {
  visible: boolean;
  mcxLiveRate: number;
  mcxChange: number;
  supremeRtgsChange: number;
  supremeCashChange: number;
  rtgsChange: number;
  cashChange: number;
  /** Provider whose bhaw sets the RTGS/Cash base, e.g. "JMD Patil". */
  bhawSourceName?: string;
  bhawRtgs?: number;
  bhawCash?: number;
  showTitle?: boolean;
  showClose?: boolean;
  onClose?: () => void;
  onApply: (mcxChangeBy: number, rtgsChangeBy: number, cashChangeBy: number) => Promise<void>;
}

export function GoldRateSettingsPanel({
  visible,
  mcxLiveRate,
  mcxChange,
  supremeRtgsChange,
  supremeCashChange,
  rtgsChange,
  cashChange,
  bhawSourceName,
  bhawRtgs,
  bhawCash,
  showTitle = true,
  showClose = false,
  onClose,
  onApply,
}: GoldRateSettingsPanelProps) {
  const [mcxSign, setMcxSign] = useState<Sign>('+');
  const [rtgsSign, setRtgsSign] = useState<Sign>('+');
  const [cashSign, setCashSign] = useState<Sign>('+');
  const [mcxAmount, setMcxAmount] = useState('0');
  const [rtgsAmount, setRtgsAmount] = useState('0');
  const [cashAmount, setCashAmount] = useState('0');
  const [savedMcxChange, setSavedMcxChange] = useState(0);
  const [savedRtgsChange, setSavedRtgsChange] = useState(0);
  const [savedCashChange, setSavedCashChange] = useState(0);
  const [saving, setSaving] = useState(false);
  const [barAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;

    const mcx = toSafeNumber(mcxChange, 0);
    const rtgs = toSafeNumber(rtgsChange, 0);
    const cash = toSafeNumber(cashChange, 0);
    const mcxForm = getSignAndAmount(mcx);
    // Shown as "bhaw already applied + this shop's own adjustment".
    const rtgsForm = getSignAndAmount(rtgs + toSafeNumber(bhawRtgs, 0));
    const cashForm = getSignAndAmount(cash + toSafeNumber(bhawCash, 0));

    setSavedMcxChange(mcx);
    setSavedRtgsChange(rtgs);
    setSavedCashChange(cash);
    setMcxSign(mcxForm.sign);
    setMcxAmount(mcxForm.amount);
    setRtgsSign(rtgsForm.sign);
    setRtgsAmount(rtgsForm.amount);
    setCashSign(cashForm.sign);
    setCashAmount(cashForm.amount);
  }, [visible, mcxChange, rtgsChange, cashChange, bhawRtgs, bhawCash]);

  /**
   * The provider bhaw is already inside the current RTGS/Cash rate, so the
   * Change By box shows it rather than adding it a second time: typing a
   * different figure moves the rate by the difference alone.
   */
  const bhawIn = (value?: number) => toSafeNumber(value, 0);
  const bhawNote = (value?: number) => {
    const amount = bhawIn(value);
    if (!bhawSourceName || !amount) return undefined;
    const sign = amount < 0 ? '−' : '+';
    return `Includes ${bhawSourceName} bhaw ${sign}${Math.abs(Math.round(amount)).toLocaleString('en-IN')}`;
  };

  const mcxDraftChange = useMemo(() => signedValue(mcxSign, mcxAmount), [mcxSign, mcxAmount]);
  const rtgsDraftChange = useMemo(
    () => signedValue(rtgsSign, rtgsAmount) - toSafeNumber(bhawRtgs, 0),
    [rtgsSign, rtgsAmount, bhawRtgs],
  );
  const cashDraftChange = useMemo(
    () => signedValue(cashSign, cashAmount) - toSafeNumber(bhawCash, 0),
    [cashSign, cashAmount, bhawCash],
  );
  const hasChanges =
    !isSameNumber(mcxDraftChange, savedMcxChange) ||
    !isSameNumber(rtgsDraftChange, savedRtgsChange) ||
    !isSameNumber(cashDraftChange, savedCashChange);

  const mcxLiveFinal = useMemo(
    () => mcxLiveRate + mcxDraftChange,
    [mcxLiveRate, mcxDraftChange],
  );

  const rtgsCurrentRate = useMemo(
    () => mcxLiveFinal + supremeRtgsChange,
    [mcxLiveFinal, supremeRtgsChange],
  );
  const cashCurrentRate = useMemo(
    () => mcxLiveFinal + supremeCashChange,
    [mcxLiveFinal, supremeCashChange],
  );
  const rtgsLiveFinal = useMemo(
    () => rtgsCurrentRate + rtgsDraftChange,
    [rtgsCurrentRate, rtgsDraftChange],
  );
  const cashLiveFinal = useMemo(
    () => cashCurrentRate + cashDraftChange,
    [cashCurrentRate, cashDraftChange],
  );

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: hasChanges ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [hasChanges, barAnim]);

  const handleRestore = () => {
    const mcxForm = getSignAndAmount(savedMcxChange);
    const rtgsForm = getSignAndAmount(savedRtgsChange + toSafeNumber(bhawRtgs, 0));
    const cashForm = getSignAndAmount(savedCashChange + toSafeNumber(bhawCash, 0));
    setMcxSign(mcxForm.sign);
    setMcxAmount(mcxForm.amount);
    setRtgsSign(rtgsForm.sign);
    setRtgsAmount(rtgsForm.amount);
    setCashSign(cashForm.sign);
    setCashAmount(cashForm.amount);
  };

  const handleApply = async () => {
    if (saving || !hasChanges) return;

    setSaving(true);
    try {
      await onApply(mcxDraftChange, rtgsDraftChange, cashDraftChange);
      setSavedMcxChange(mcxDraftChange);
      setSavedRtgsChange(rtgsDraftChange);
      setSavedCashChange(cashDraftChange);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {showClose && onClose ? (
        <Pressable onPress={onClose} hitSlop={8} style={styles.modalClose}>
          <X size={20} color={Colors.textSecondary} />
        </Pressable>
      ) : null}

      {showTitle ? <Text style={styles.modalTitle}>Gold Rate Settings</Text> : null}

      <View style={styles.modalBody}>
        <RateCard
          title="MCX Rate"
          subtitle=""
          icon={null}
          sign={mcxSign}
          amount={mcxAmount}
          currentRate={mcxLiveRate}
          finalRate={mcxLiveFinal}
          formula=""
          currentLabel="Current MCX Rate"
          finalLabel="Final MCX Rate"
          onSignChange={setMcxSign}
          onAmountChange={setMcxAmount}
        />

        <RateCard
          title="RTGS Rate"
          subtitle={bhawNote(bhawRtgs)}
          showCurrentRate={false}
          icon={null}
          sign={rtgsSign}
          amount={rtgsAmount}
          currentRate={rtgsCurrentRate}
          finalRate={rtgsLiveFinal}
          formula={''}
          currentLabel="Current RTGS Rate"
          finalLabel="Final RTGS Rate"
          onSignChange={setRtgsSign}
          onAmountChange={setRtgsAmount}
        />

        <RateCard
          title="Cash Rate"
          subtitle={bhawNote(bhawCash)}
          showCurrentRate={false}
          icon={null}
          sign={cashSign}
          amount={cashAmount}
          currentRate={cashCurrentRate}
          finalRate={cashLiveFinal}
          formula={''}
          currentLabel="Current Cash Rate"
          finalLabel="Final Cash Rate"
          onSignChange={setCashSign}
          onAmountChange={setCashAmount}
        />
      </View>

      <Animated.View
        pointerEvents={hasChanges ? 'auto' : 'none'}
        style={[
          styles.bottomActionBar,
          {
            opacity: barAnim,
            transform: [
              {
                translateY: barAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }),
              },
            ],
          },
        ]}
      >
        <Pressable
          onPress={handleRestore}
          disabled={saving}
          style={[styles.restoreBtn, saving && styles.actionBtnDisabled]}
        >
          <Text style={styles.restoreBtnText}>Restore</Text>
        </Pressable>

        <Pressable
          onPress={() => void handleApply()}
          disabled={saving}
          style={[styles.applyBtn, saving && styles.actionBtnDisabled]}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.applyBtnText}>Apply</Text>
          )}
        </Pressable>
      </Animated.View>
    </>
  );
}

interface GoldRateSettingsModalProps {
  visible: boolean;
  mcxLiveRate: number;
  mcxChange: number;
  supremeRtgsChange: number;
  supremeCashChange: number;
  rtgsChange: number;
  cashChange: number;
  /** Provider whose bhaw sets the RTGS/Cash base, e.g. "JMD Patil". */
  bhawSourceName?: string;
  bhawRtgs?: number;
  bhawCash?: number;
  onClose: () => void;
  onApply: (mcxChangeBy: number, rtgsChangeBy: number, cashChangeBy: number) => Promise<void>;
}

export function GoldRateSettingsModal({
  visible,
  mcxLiveRate,
  mcxChange,
  supremeRtgsChange,
  supremeCashChange,
  rtgsChange,
  cashChange,
  bhawSourceName,
  bhawRtgs,
  bhawCash,
  onClose,
  onApply,
}: GoldRateSettingsModalProps) {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={screenStyles.modalOverlay}>
        <View style={[screenStyles.modalCard, styles.settingsModalCard]}>
          <GoldRateSettingsPanel
            visible={visible}
            mcxLiveRate={mcxLiveRate}
            mcxChange={mcxChange}
            supremeRtgsChange={supremeRtgsChange}
            supremeCashChange={supremeCashChange}
            rtgsChange={rtgsChange}
            cashChange={cashChange}
            bhawSourceName={bhawSourceName}
            bhawRtgs={bhawRtgs}
            bhawCash={bhawCash}
            onClose={onClose}
            onApply={onApply}
            showClose
            showTitle
          />
        </View>
      </View>
    </Modal>
  );
}

// Backward-compatible aliases for existing imports
export const GoldTaxSettingsRow = GoldRateSettingsRow;
export const GoldTaxSettingsModal = GoldRateSettingsModal;

interface GoldRateChangeEditModalProps {
  visible: boolean;
  target: TaxChangeTarget | null;
  currentChange: number;
  onClose: () => void;
  onApply: (change: number) => void;
}

export function GoldRateChangeEditModal({
  visible,
  target,
  currentChange,
  onClose,
  onApply,
}: GoldRateChangeEditModalProps) {
  const [direction, setDirection] = useState<Sign>(currentChange < 0 ? '-' : '+');
  const [amount, setAmount] = useState(String(Math.abs(currentChange)));
  const [directionOpen, setDirectionOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setDirection(currentChange < 0 ? '-' : '+');
      setAmount(String(Math.abs(currentChange)));
      setDirectionOpen(false);
    }
  }, [visible, currentChange, target]);

  const resetForm = () => {
    setDirection(currentChange < 0 ? '-' : '+');
    setAmount(String(Math.abs(currentChange)));
    setDirectionOpen(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleApply = () => {
    const parsed = Number(amount.replace(/[^\d.]/g, ''));
    const safeAmount = Number.isFinite(parsed) ? parsed : 0;
    const signedChange = direction === '-' ? -safeAmount : safeAmount;
    onApply(signedChange);
    handleClose();
  };

  const directionLabel = direction === '+' ? 'Increase By (+)' : 'Decrease By (-)';
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
              {(['+', '-'] as Sign[]).map((opt) => (
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
                    {opt === '+' ? 'Increase By (+)' : 'Decrease By (-)'}
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
            placeholder="₹ Amount"
            placeholderTextColor={Colors.placeholder}
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Pressable onPress={handleClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleApply} style={styles.applyBtnLegacy}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const GoldTaxChangeEditModal = GoldRateChangeEditModal;

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
  settingsModalCard: { height: '86%', maxHeight: '86%', paddingBottom: 0 },
  modalClose: { alignSelf: 'flex-end' },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  modalBody: {
    flexGrow: 1,
    gap: 6,
    paddingBottom: GOLD_ACTION_BAR_HEIGHT,
  },
  rateCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: Spacing.xs,
    backgroundColor: Colors.white,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rateCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4ECDC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconText: {
    fontSize: 18,
    fontWeight: '700',
    color: BUTTON_GREEN,
  },
  rateCardHeaderTextWrap: { flex: 1 },
  rateCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  rateCardSubtitle: { marginTop: 2, fontSize: 12, color: Colors.textSecondary },
  currentRatePill: {
    borderRadius: Radius.input,
    backgroundColor: '#FBF7F0',
    padding: 6,
    gap: 2,
  },
  currentRateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentRateValue: {
    fontSize: 13,
    fontWeight: '700',
    color: BUTTON_GREEN,
  },
  changeSection: { gap: 6 },
  fieldLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signToggleWrap: { width: 74 },
  signToggle: {
    minHeight: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    flexDirection: 'row',
  },
  signToggleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  signToggleBtnActive: { backgroundColor: '#F4ECDC' },
  signToggleText: {
    fontSize: 16,
    lineHeight: 18,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  signToggleTextActive: { color: BUTTON_GREEN, fontWeight: '700' },
  amountInputWrap: {
    minHeight: 32,
    flex: 1,
    minWidth: 96,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  amountPrefix: {
    marginRight: 6,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  amountInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  cardDivider: {
    marginTop: Spacing.xs,
    height: 1,
    backgroundColor: Colors.border,
  },
  finalSection: { gap: 4 },
  finalLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  finalValue: {
    marginTop: 0,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: BUTTON_GREEN,
  },
  formulaText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  bottomActionBar: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#E9DDC4',
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  restoreBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#E9DDC4',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  restoreBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#857A63',
  },
  applyBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BUTTON_GREEN,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  actionBtnDisabled: {
    opacity: 0.7,
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
  applyBtnLegacy: {
    flex: 1,
    height: Spacing.buttonHeight,
    backgroundColor: BUTTON_GREEN,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
