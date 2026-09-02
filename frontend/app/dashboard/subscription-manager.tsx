import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowRight, BarChart3, ChevronLeft, Clock3, History, ShieldCheck, Wallet } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';
import { useAuthStore } from '@/store/authStore';
import type { SubscriptionOverview } from '@/types/subscription';
import {
  createCreditRechargeOrder,
  fetchSubscriptionOverview,
  isPaymentCancellation,
  markPaymentFailure,
  startFreeTrial,
  validateRazorpayPaymentResult,
  verifyPayment,
} from '@/utils/subscriptionApi';
import Constants from 'expo-constants';

type RazorpayModule = {
  open: (options: Record<string, unknown>) => Promise<unknown>;
};

function getRazorpayCheckout(): RazorpayModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = require('react-native-razorpay');
    const candidate = (mod?.default ?? mod) as RazorpayModule | null;
    if (!candidate || typeof candidate.open !== 'function') {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

function assertRazorpayReady(): void {
  if (Constants.appOwnership === 'expo') {
    throw new Error('Razorpay does not work in Expo Go. Please use a development build or preview APK.');
  }

  const RazorpayCheckout = getRazorpayCheckout();
  if (!RazorpayCheckout) {
    throw new Error('Razorpay SDK not available in this build. Rebuild the app after installing react-native-razorpay.');
  }
}

function currency(value: number): string {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function currencyDisplay(value: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function currencyNoDecimal(value: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}

const BOTTOM_NAV_HEIGHT = 70;
const BOTTOM_NAV_OFFSET = -4;

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function trialTimeLabel(days: number, hours: number): string {
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} remaining`;
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} remaining`;
  return 'Less than 1 hour remaining';
}

export default function SubscriptionManagerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const allowed = useRequireSettingsAccess('subscription');
  const userRole = useAuthStore((s) => s.userRole);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number>(500);
  const [usingCustomAmount, setUsingCustomAmount] = useState(false);

  const canManagePayments = userRole === 'business';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSubscriptionOverview();
      setOverview(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load credit details.';
      Alert.alert('Credits & Subscription', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const runRazorpayCheckout = useCallback(async (order: {
    orderId: string;
    amountInPaise: number;
    razorpayKeyId?: string | null;
  }) => {
    const RazorpayCheckout = getRazorpayCheckout();
    if (!RazorpayCheckout) {
      throw new Error('Razorpay SDK missing. Install react-native-razorpay to continue.');
    }

    const key = order.razorpayKeyId || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';
    if (!key) {
      throw new Error('Razorpay key id is missing on frontend.');
    }

    let payment;
    try {
      const checkoutResult = await RazorpayCheckout.open({
        key,
        amount: order.amountInPaise,
        currency: 'INR',
        order_id: order.orderId,
        name: 'MRP Scanner',
        description: 'Credit Recharge',
        theme: { color: Colors.primary },
      });
      payment = validateRazorpayPaymentResult(checkoutResult, order.orderId);
    } catch (error) {
      const raw = error as { description?: unknown } | null;
      const failureMessage = error instanceof Error
        ? error.message
        : String(raw?.description || 'Payment cancelled or failed.');
      try {
        await markPaymentFailure(order.orderId, null, failureMessage);
      } catch (recordError) {
        console.warn('Failed to record cancelled Razorpay checkout', recordError);
      }
      throw error;
    }

    await verifyPayment(order.orderId, payment.razorpay_payment_id, payment.razorpay_signature);
  }, []);

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await loadData();
    } catch (error) {
      if (!isPaymentCancellation(error)) {
        const message = error instanceof Error ? error.message : 'Action failed.';
        Alert.alert('Credits & Subscription', message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleStartTrial = async () => {
    await runAction(async () => {
      await startFreeTrial();
      Alert.alert(
        'Free Trial Started',
        '100 free scanning credits have been granted.\n\nYour free trial is valid for 10 days.',
      );
    });
  };

  const handleRecharge = async () => {
    const amount = usingCustomAmount ? Number(rechargeAmount || 0) : selectedAmount;
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Recharge Credits', 'Please enter a valid recharge amount.');
      return;
    }

    await runAction(async () => {
      assertRazorpayReady();
      const order = await createCreditRechargeOrder(amount);
      await runRazorpayCheckout(order);
    });
  };

  const quickAmounts = [500, 1000, 5000, 10000];

  const selectQuickAmount = (amount: number) => {
    setUsingCustomAmount(false);
    setSelectedAmount(amount);
    setRechargeAmount('');
  };

  const activateCustomAmount = () => {
    if (usingCustomAmount) return;
    setUsingCustomAmount(true);
    setRechargeAmount('');
    setSelectedAmount(0);
  };

  const handleCustomAmountChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    setRechargeAmount(sanitized);
    const amount = Number(sanitized || 0);
    setSelectedAmount(Number.isFinite(amount) && amount > 0 ? amount : 0);
  };

  const isTrialActive = overview?.status === 'FREE_TRIAL_LICENSE';
  const showStartTrial = overview?.status === 'NO_LICENSE' && !overview?.trialExpiredAt;
  const isPermanent = overview?.status === 'PERMANENT_LICENSE' || overview?.applicationPurchased;
  const selectedRechargeAmount = Math.max(
    0,
    usingCustomAmount ? Number(rechargeAmount || 0) : selectedAmount,
  );
  const rechargeButtonLabel = selectedRechargeAmount > 0
    ? `Recharge ${currencyNoDecimal(selectedRechargeAmount)}`
    : 'Continue to Payment';
  const bottomNavTotalHeight = Math.max(0, BOTTOM_NAV_HEIGHT + BOTTOM_NAV_OFFSET + insets.bottom);
  const bottomContentSpacing = bottomNavTotalHeight + Spacing.xl;
  const trialTag = useMemo(() => {
    if (!overview || !isTrialActive) return null;
    return trialTimeLabel(Number(overview.trialDaysRemaining || 0), Number(overview.trialHoursRemaining || 0));
  }, [isTrialActive, overview]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <ChevronLeft size={22} color={Colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Credits & Subscription</Text>
            <Text style={styles.headerSubtitle}>Manage your credits, usage and payments</Text>
          </View>
        </View>

        {!allowed || loading || !overview ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomContentSpacing }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWrap}>
              <View style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                  <View style={styles.statusPill}>
                    <ShieldCheck size={13} color="#5E4A2E" />
                    <Text style={styles.statusText}>{formatStatus(overview.status)}</Text>
                  </View>
                  {trialTag ? (
                    <View style={styles.trialPill}>
                      <Clock3 size={12} color={Colors.white} />
                      <Text style={styles.trialText}>{trialTag}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.walletLabel}>Wallet Balance</Text>
                <Text style={styles.walletValue}>{currencyDisplay(overview.creditBalance)}</Text>

                {showStartTrial ? (
                  <Pressable disabled={busy} onPress={handleStartTrial} style={styles.heroBtn}>
                    <Text style={styles.heroBtnText}>{busy ? 'Please wait...' : 'Start Free Trial'}</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.statsCard}>
                <View style={styles.statsCol}>
                  <View style={styles.statsHeaderRow}>
                    <Text style={styles.statsLabel}>Today</Text>
                  </View>
                  <Text style={styles.statsValue}>{overview.todayScans} Scans</Text>
                  <Text style={styles.statsCost}>{currency(overview.todayScanCost || 0)} spent</Text>
                </View>

                <View style={styles.statsDivider} />

                <View style={styles.statsCol}>
                  <View style={styles.statsHeaderRow}>
                    <Text style={styles.statsLabel}>This Month</Text>
                  </View>
                  <Text style={styles.statsValue}>{overview.monthScans} Scans</Text>
                  <Text style={styles.statsCost}>{currency(overview.currentMonthCost || 0)} spent</Text>
                </View>
              </View>

              {canManagePayments && isPermanent ? (
                <View style={styles.actionCard}>
                  <Text style={styles.cardTitle}>Recharge Credits</Text>
                  <Text style={styles.cardHelper}>Add credits to your wallet</Text>

                  <View style={styles.quickAmountGrid}>
                    {quickAmounts.map((amount) => {
                      const isSelected = !usingCustomAmount && selectedAmount === amount;
                      const tierLabel = amount === 500
                        ? 'Starter'
                        : amount === 1000
                          ? 'Popular'
                          : amount === 5000
                            ? 'Business'
                            : 'Premium';
                      return (
                        <Pressable
                          key={amount}
                          onPress={() => selectQuickAmount(amount)}
                          style={[styles.quickAmountCard, isSelected && styles.quickAmountCardSelected]}
                        >
                          <View style={styles.quickAmountTopRow}>
                            <Text style={[styles.quickAmountBadge, isSelected && styles.quickAmountBadgeSelected]}>
                              {tierLabel}
                            </Text>
                            <Text style={[styles.quickAmountSubtle, isSelected && styles.quickAmountSubtleSelected]}>
                              {Number(amount).toLocaleString('en-IN')} cr
                            </Text>
                          </View>
                          <Text style={[styles.quickAmountTitle, isSelected && styles.quickAmountTitleSelected]}>
                            {currencyNoDecimal(amount)}
                          </Text>
                          <Text style={[styles.quickAmountSub, isSelected && styles.quickAmountSubSelected]}>
                            Instant credit top-up
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.customAmountCard}>
                    <View style={styles.customAmountHeader}>
                      <Text style={styles.customAmountTitle}>Custom amount</Text>
                      <Pressable onPress={activateCustomAmount} style={styles.customAmountAction}>
                        <Text style={styles.customAmountActionText}>{usingCustomAmount ? 'Editing' : 'Use custom'}</Text>
                        <ArrowRight size={13} color={Colors.primary} />
                      </Pressable>
                    </View>

                    <View style={[styles.customInputWrap, usingCustomAmount && styles.customInputWrapActive]}>
                      <Text style={styles.inputPrefix}>₹</Text>
                      <TextInput
                        value={rechargeAmount}
                        onFocus={activateCustomAmount}
                        onChangeText={handleCustomAmountChange}
                        keyboardType="decimal-pad"
                        style={styles.amountInput}
                        accessibilityLabel="Custom amount"
                      />
                    </View>

                    <Text style={styles.customHint}>Credits are added instantly after successful payment.</Text>
                  </View>

                  <Pressable disabled={busy} onPress={handleRecharge} style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}>
                    <Text style={styles.primaryBtnText}>{busy ? 'Processing...' : rechargeButtonLabel}</Text>
                  </Pressable>
                </View>
              ) : null}

              {canManagePayments && !isPermanent ? (
                <Pressable onPress={() => router.push('/dashboard/purchase-license')} style={styles.linkCard}>
                  <View style={styles.linkRowBetween}>
                    <View style={styles.linkLeft}>
                      <ShieldCheck size={18} color={Colors.primary} />
                      <View>
                        <Text style={styles.linkTitle}>Purchase Application License</Text>
                        <Text style={styles.linkSubtitle}>₹12,000 one-time purchase</Text>
                      </View>
                    </View>
                    <ArrowRight size={18} color={Colors.textSecondary} />
                  </View>
                </Pressable>
              ) : null}

              <View style={styles.linkStack}>
                <Pressable onPress={() => router.push('/dashboard/payment-history')} style={styles.linkCard}>
                  <View style={styles.linkRowBetween}>
                    <View style={styles.linkLeft}>
                      <History size={18} color={Colors.primary} />
                      <View>
                        <Text style={styles.linkTitle}>Payment History</Text>
                        <Text style={styles.linkSubtitle}>View payments, orders and transactions</Text>
                      </View>
                    </View>
                    <ArrowRight size={18} color={Colors.textSecondary} />
                  </View>
                </Pressable>

                <Pressable onPress={() => router.push('/dashboard/credit-history')} style={styles.linkCard}>
                  <View style={styles.linkRowBetween}>
                    <View style={styles.linkLeft}>
                      <Wallet size={18} color={Colors.primary} />
                      <View>
                        <Text style={styles.linkTitle}>Credit History</Text>
                        <Text style={styles.linkSubtitle}>View wallet transactions</Text>
                      </View>
                    </View>
                    <ArrowRight size={18} color={Colors.textSecondary} />
                  </View>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.md,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  header: {
    paddingTop: 4,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTextWrap: {
    flex: 1,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    marginTop: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrap: {
    gap: 10,
  },
  heroCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#E7D9BD',
    backgroundColor: '#FFF8EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5E9D2',
    borderRadius: Radius.badge,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    color: '#5E4A2E',
    fontWeight: '700',
  },
  trialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: Radius.badge,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  trialText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  walletLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#624C27',
    fontWeight: '600',
    textAlign: 'center',
  },
  walletValue: {
    marginTop: 2,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
  },
  heroBtn: {
    marginTop: 12,
    backgroundColor: '#B8860B',
    borderRadius: Radius.button,
    paddingVertical: 11,
    alignItems: 'center',
  },
  heroBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  statsCard: {
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.white,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statsCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  statsValue: {
    marginTop: 4,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '700',
    lineHeight: 19,
  },
  statsCost: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  actionCard: {
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.white,
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardHelper: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  quickAmountGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 9,
  },
  quickAmountCard: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: '#E7E2D8',
    borderRadius: Radius.input,
    paddingHorizontal: 11,
    paddingVertical: 10,
    backgroundColor: '#FEFCF8',
  },
  quickAmountCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F3F8F5',
    shadowColor: '#1F2E27',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  quickAmountTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  quickAmountBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6E5735',
    backgroundColor: '#F7EDDB',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  quickAmountBadgeSelected: {
    color: Colors.primary,
    backgroundColor: '#E7F1EC',
  },
  quickAmountSubtle: {
    fontSize: 11,
    color: '#8A8376',
    fontWeight: '600',
  },
  quickAmountSubtleSelected: {
    color: '#4A5E53',
  },
  quickAmountTitle: {
    fontSize: 20,
    lineHeight: 22,
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  quickAmountTitleSelected: {
    color: Colors.primary,
  },
  quickAmountSub: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  quickAmountSubSelected: {
    color: '#5F6E66',
  },
  customAmountCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E8E2D7',
    borderRadius: Radius.input,
    backgroundColor: '#FFFDFA',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  customAmountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customAmountTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  customAmountAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  customAmountActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  customInputWrap: {
    borderWidth: 1,
    borderColor: '#DDD6C9',
    borderRadius: Radius.input,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  customInputWrapActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FBF7F0',
  },
  inputPrefix: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  customHint: {
    marginTop: 7,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.button,
    paddingVertical: 11,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  linkStack: {
    gap: 6,
  },
  linkCard: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.input,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkTitle: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  linkSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
