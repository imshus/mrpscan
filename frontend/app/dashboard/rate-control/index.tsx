import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronLeft, CircleDollarSign, Landmark, Wallet } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ToastNotification, type ToastType } from '@/components/scanner/ToastNotification';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { apiRequest } from '@/utils/apiClient';
import { formatInr } from '@/utils/rateMappers';

type Sign = '+' | '-';
interface SupremeRatesData {
  mcx?: unknown;
  rtgsChange?: unknown;
  cashChange?: unknown;
  updatedAt?: unknown;
  mcxUpdatedAt?: unknown;
  lastUpdatedAt?: unknown;
}

interface SupremeRatesResponse {
  data?: SupremeRatesData;
}

interface RateAdjustmentCardProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  sign: Sign;
  amount: string;
  finalRate: number;
  onSignChange: (next: Sign) => void;
  onAmountChange: (value: string) => void;
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

function toSafeNumber(value: unknown, fallback = 0): number {
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
  const absolute = Math.abs(value);
  return {
    sign: value < 0 ? '-' : '+',
    // Zero shows the "Amount" placeholder instead of a literal "0".
    amount: absolute ? String(absolute) : '',
  };
}

function isSameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0001;
}

function formatUpdatedLabel(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RateAdjustmentCard({
  title,
  subtitle,
  icon: Icon,
  sign,
  amount,
  finalRate,
  onSignChange,
  onAmountChange,
}: RateAdjustmentCardProps) {
  return (
    <View style={styles.rateCard}>
      <View style={styles.rateCardHeader}>
        <View style={styles.rateCardIconWrap}>
          <Icon size={18} color={Colors.primary} />
        </View>
        <View style={styles.rateCardHeaderTextWrap}>
          <Text style={styles.rateCardTitle}>{title}</Text>
          <Text style={styles.rateCardSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.changeSection}>
        <Text style={styles.fieldLabel}>Change By</Text>
        <View style={styles.controlsRow}>
          <View style={styles.signDropdownWrap}>
            <SignToggle value={sign} onChange={onSignChange} />
          </View>

          <View style={styles.amountInputWrap}>
            <Text style={styles.amountPrefix}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={onAmountChange}
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
        <Text style={styles.finalLabel}>Final {title}</Text>
        <Text style={styles.finalValue}>{formatInr(finalRate)}</Text>
      </View>
    </View>
  );
}

export default function RateControlScreen() {
  const router = useRouter();
  const isSuper = useAuthStore((s) => s.isSuper);

  const [loading, setLoading] = useState(true);
  const [mcx, setMcx] = useState(0);
  const [mcxUpdatedAtLabel, setMcxUpdatedAtLabel] = useState<string | null>(null);

  const [savedRtgsChange, setSavedRtgsChange] = useState(0);
  const [savedCashChange, setSavedCashChange] = useState(0);

  const [rtgsSign, setRtgsSign] = useState<Sign>('+');
  const [cashSign, setCashSign] = useState<Sign>('+');
  const [rtgsAmount, setRtgsAmount] = useState('');
  const [cashAmount, setCashAmount] = useState('');

  const [savingAll, setSavingAll] = useState(false);
  const [barAnim] = useState(() => new Animated.Value(0));
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  const parseResponseData = (
    response: SupremeRatesResponse | SupremeRatesData | null | undefined,
  ): SupremeRatesData => {
    if (!response) return {};
    if (typeof response === 'object' && 'data' in response) {
      return (response as SupremeRatesResponse).data ?? {};
    }
    if (typeof response === 'object') return (response as SupremeRatesData) ?? {};
    return {};
  };

  const applyDataToState = useCallback((raw: SupremeRatesData) => {
    const nextMcx = toSafeNumber(raw.mcx);
    const nextRtgs = toSafeNumber(raw.rtgsChange);
    const nextCash = toSafeNumber(raw.cashChange);

    const rtgsForm = getSignAndAmount(nextRtgs);
    const cashForm = getSignAndAmount(nextCash);

    setMcx(nextMcx);
    setSavedRtgsChange(nextRtgs);
    setSavedCashChange(nextCash);
    setRtgsSign(rtgsForm.sign);
    setRtgsAmount(rtgsForm.amount);
    setCashSign(cashForm.sign);
    setCashAmount(cashForm.amount);

    const updated =
      formatUpdatedLabel(raw.mcxUpdatedAt) ??
      formatUpdatedLabel(raw.lastUpdatedAt) ??
      formatUpdatedLabel(raw.updatedAt);
    setMcxUpdatedAtLabel(updated);
  }, []);

  const loadSupremeRates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<SupremeRatesResponse>('/settings/supreme-rates');
      const data = parseResponseData(response);
      applyDataToState(data);
    } catch {
      showToast('Failed to fetch supreme rates', 'error');
    } finally {
      setLoading(false);
    }
  }, [applyDataToState]);

  useEffect(() => {
    if (!isSuper) {
      router.replace('/dashboard/settings');
      return;
    }

    void loadSupremeRates();
  }, [isSuper, router, loadSupremeRates]);

  const rtgsDraftChange = useMemo(() => signedValue(rtgsSign, rtgsAmount), [rtgsSign, rtgsAmount]);
  const cashDraftChange = useMemo(() => signedValue(cashSign, cashAmount), [cashSign, cashAmount]);

  const rtgsFinalRate = useMemo(() => mcx + rtgsDraftChange, [mcx, rtgsDraftChange]);
  const cashFinalRate = useMemo(() => mcx + cashDraftChange, [mcx, cashDraftChange]);

  const rtgsChanged = !isSameNumber(rtgsDraftChange, savedRtgsChange);
  const cashChanged = !isSameNumber(cashDraftChange, savedCashChange);

  const sanitizeAmount = (value: string) => value.replace(/\D/g, '');

  const hasAnyChanges = rtgsChanged || cashChanged;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: hasAnyChanges ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [hasAnyChanges, barAnim]);

  const handleRestore = () => {
    const rtgsForm = getSignAndAmount(savedRtgsChange);
    const cashForm = getSignAndAmount(savedCashChange);
    setRtgsSign(rtgsForm.sign);
    setRtgsAmount(rtgsForm.amount);
    setCashSign(cashForm.sign);
    setCashAmount(cashForm.amount);
  };

  const handleApplyAll = async () => {
    if (savingAll || !hasAnyChanges) return;

    setSavingAll(true);
    try {
      const response = await apiRequest<SupremeRatesResponse>('/settings/supreme-rates', {
        method: 'PUT',
        body: { rtgsChange: rtgsDraftChange, cashChange: cashDraftChange },
      });
      const data = parseResponseData(response);

      const resolvedRtgs = toSafeNumber(data.rtgsChange, rtgsDraftChange);
      const resolvedCash = toSafeNumber(data.cashChange, cashDraftChange);
      const resolvedMcx = toSafeNumber(data.mcx, mcx);

      setMcx(resolvedMcx);
      setSavedRtgsChange(resolvedRtgs);
      setSavedCashChange(resolvedCash);

      const rtgsForm = getSignAndAmount(resolvedRtgs);
      const cashForm = getSignAndAmount(resolvedCash);
      setRtgsSign(rtgsForm.sign);
      setRtgsAmount(rtgsForm.amount);
      setCashSign(cashForm.sign);
      setCashAmount(cashForm.amount);

      showToast('Rate adjustments applied', 'success');
    } catch {
      showToast('Failed to save supreme rates', 'error');
    } finally {
      setSavingAll(false);
    }
  };

  if (!isSuper) return null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <BackgroundPattern />
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loaderText}>Loading rate controls...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerWrap}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
              <ChevronLeft size={18} color={Colors.textPrimary} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>

            <Text style={styles.pageTitle}>Rate Control Panel</Text>
            <Text style={styles.pageSubtitle}>Configure Supreme RTGS & Cash Rate Adjustments</Text>
          </View>

          <View style={styles.sectionWrap}>
            <View style={styles.mcxCard}>
              <View style={styles.mcxTopRow}>
                <View>
                  <Text style={styles.mcxTitle}>MCX Rate</Text>
                  <Text style={styles.mcxSubTitle}>24K Gold • Per 10 gm</Text>
                </View>
                <View style={styles.mcxIconWrap}>
                  <CircleDollarSign size={20} color={Colors.accentGold} />
                </View>
              </View>

              <Text style={styles.mcxValue}>{formatInr(mcx)}</Text>

              {mcxUpdatedAtLabel ? (
                <Text style={styles.updatedAtText}>Updated {mcxUpdatedAtLabel}</Text>
              ) : null}
            </View>

            <RateAdjustmentCard
              title="RTGS Rate"
              subtitle="Configure Supreme RTGS Adjustment"
              icon={Landmark}
              sign={rtgsSign}
              amount={rtgsAmount}
              finalRate={rtgsFinalRate}
              onSignChange={setRtgsSign}
              onAmountChange={(value) => setRtgsAmount(sanitizeAmount(value))}
            />

            <RateAdjustmentCard
              title="Cash Rate"
              subtitle="Configure Supreme Cash Adjustment"
              icon={Wallet}
              sign={cashSign}
              amount={cashAmount}
              finalRate={cashFinalRate}
              onSignChange={setCashSign}
              onAmountChange={(value) => setCashAmount(sanitizeAmount(value))}
            />
          </View>
        </ScrollView>

        <Animated.View
          pointerEvents={hasAnyChanges ? 'auto' : 'none'}
          style={[
            styles.bottomActionBar,
            {
              transform: [
                {
                  translateY: barAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }),
                },
              ],
              opacity: barAnim,
            },
          ]}
        >
          <Pressable
            onPress={handleRestore}
            disabled={savingAll}
            style={[styles.restoreBtn, savingAll && styles.actionBtnDisabled]}
          >
            <Text style={styles.restoreBtnText}>Restore</Text>
          </Pressable>

          <PrimaryButton
            title="Apply"
            onPress={() => void handleApplyAll()}
            loading={savingAll}
            disabled={savingAll}
            style={styles.bottomApplyBtn}
          />
        </Animated.View>
      </KeyboardAvoidingView>

      <ToastNotification
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      <BottomNav activeRoute="home" />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.screenBottom + 24,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loaderText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  headerWrap: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pageTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pageSubtitle: {
    marginTop: Spacing.xs,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
  },
  sectionWrap: {
    marginHorizontal: Spacing.screenHorizontal,
    gap: Spacing.sm,
  },
  mcxCard: {
    borderRadius: Radius.card,
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 6,
  },
  mcxTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mcxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accentGold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  mcxSubTitle: {
    marginTop: 2,
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 16,
  },
  mcxIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(212, 193, 156, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mcxValue: {
    marginTop: Spacing.sm,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700',
    color: Colors.white,
  },
  updatedAtText: {
    marginTop: Spacing.xs,
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
  },
  rateCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  rateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rateCardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateCardHeaderTextWrap: {
    flex: 1,
  },
  rateCardTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rateCardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  changeSection: {
    marginTop: Spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: Spacing.sm,
  },
  signDropdownWrap: {
    width: 88,
  },
  signToggle: {
    minHeight: 44,
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
    minHeight: 44,
  },
  signToggleBtnActive: {
    backgroundColor: '#F4ECDC',
  },
  signToggleText: {
    fontSize: 18,
    lineHeight: 22,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  signToggleTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  amountInputWrap: {
    minHeight: 44,
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  amountPrefix: {
    marginRight: 8,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  cardDivider: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    height: 1,
    backgroundColor: Colors.border,
  },
  finalSection: {
    gap: 4,
  },
  finalLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  finalValue: {
    marginTop: 2,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    color: Colors.primary,
  },
  bottomActionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16 + Spacing.screenBottom,
    borderTopWidth: 1,
    borderTopColor: '#E9DDC4',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  restoreBtn: {
    flexBasis: '48%',
    maxWidth: '48%',
    minWidth: '48%',
    height: 52,
    borderWidth: 1,
    borderColor: '#E9DDC4',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  restoreBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#857A63',
  },
  bottomApplyBtn: {
    flexBasis: '48%',
    maxWidth: '48%',
    minWidth: '48%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#18352C',
  },
  actionBtnDisabled: {
    opacity: 0.7,
  },
});
