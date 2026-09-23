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
import { Check, ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientView } from '@/components/ui/GradientView';
import { Colors, Fonts, Radius, Spacing, Surfaces } from '@/constants/theme';
import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';
import { useAuthStore } from '@/store/authStore';
import type { SubscriptionOverview } from '@/types/subscription';
import {
  createApplicationPurchaseOrder,
  createCreditRechargeOrder,
  fetchSubscriptionOverview,
  isPaymentCancellation,
  markPaymentFailure,
  validateRazorpayPaymentResult,
  verifyPayment,
} from '@/utils/subscriptionApi';
import { friendlyServerMessage } from '@/utils/serverMessages';
import Constants from 'expo-constants';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

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

// A shop topping up mid-day wants fifty rupees of credits, not five hundred.
const MIN_RECHARGE = 50;
const QUICK_AMOUNTS = [50, 100, 250, 500];

function assertRazorpayReady(): void {
  if (Constants.appOwnership === 'expo') {
    throw new Error('Razorpay does not work in Expo Go. Please use a development build or preview APK.');
  }

  const RazorpayCheckout = getRazorpayCheckout();
  if (!RazorpayCheckout) {
    throw new Error('Razorpay SDK not available in this build. Rebuild the app after installing react-native-razorpay.');
  }
}

function rupees(value: number): string {
  return `₹ ${Number(value || 0).toLocaleString('en-IN')}`;
}

function toPurchaseState(overview: SubscriptionOverview | null): 'LOADING' | 'PERMANENT' | 'CAN_PURCHASE' {
  if (!overview) return 'LOADING';
  if (overview.status === 'PERMANENT_LICENSE' || overview.applicationPurchased) {
    return 'PERMANENT';
  }
  return 'CAN_PURCHASE';
}

/**
 * The two panels' gradients, measured off the shop's design: khaki, light at
 * the top to deep at the foot, for the trial; coral to deep red for the
 * subscription. Drawn as real gradients on this one card, at the shop's
 * asking, while the rest of the app stays flat.
 */
const TRIAL_PANEL_GRADIENT = ['#F8F5EB', '#E6DBC3', '#C7B792'];
const PREMIUM_PANEL_GRADIENT = ['#E9AA9A', '#BE5B4A', Surfaces.premium];

export default function PurchaseLicenseScreen() {
  const router = useRouter();
  const allowed = useRequireSettingsAccess('subscription');
  const userRole = useAuthStore((s) => s.userRole);

  const [loading, setLoading] = useState(true);
  // Which action is under way, so only its own button says so: a recharge
  // used to turn Purchase Now into 'Processing…' as well.
  const [busyAction, setBusyAction] = useState<'purchase' | 'recharge' | null>(null);
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);

  const canManagePayments = userRole === 'business';

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSubscriptionOverview();
      setOverview(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load subscription details.';
      Alert.alert('License Purchase', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOverview();
    }, [loadOverview]),
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
        name: 'MRPscan',
        // The business phone on file: fewer taps in the sheet, and Razorpay's
        // risk checks see a consistent customer.
        prefill: { contact: String(useAuthStore.getState().registration?.phone ?? '') },
        description: 'Application License Purchase',
        theme: { color: Colors.primary },
      });
      payment = validateRazorpayPaymentResult(checkoutResult, order.orderId);
    } catch (error) {
      const raw = error as { description?: unknown } | null;
      const failureMessage = error instanceof Error
        ? error.message
        : String(raw?.description || 'Payment cancelled or failed.');
      // Recording a cancelled checkout is best-effort and must not replace the
      // original Razorpay cancellation with a misleading app error.
      try {
        await markPaymentFailure(order.orderId, null, failureMessage);
      } catch (recordError) {
        console.warn('Failed to record cancelled Razorpay checkout', recordError);
      }
      throw error;
    }

    // Verify the locally created order, not an unchecked order id supplied by
    // the SDK callback. The API only accepts a captured payment.
    await verifyPayment(order.orderId, payment.razorpay_payment_id, payment.razorpay_signature);
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!canManagePayments) {
      Alert.alert('License Purchase', 'Only business account can purchase application license.');
      return;
    }

    setBusyAction('purchase');
    try {
      assertRazorpayReady();
      const order = await createApplicationPurchaseOrder();
      await runRazorpayCheckout(order);

      const refreshed = await fetchSubscriptionOverview();
      setOverview(refreshed);

      if (refreshed.status !== 'PERMANENT_LICENSE' && !refreshed.applicationPurchased) {
        throw new Error('Payment verified. License activation is pending. Please refresh shortly.');
      }

      Alert.alert(
        'License Activated',
        'Your application license is active and bonus wallet credits have been added.',
        [{ text: 'Continue', onPress: () => router.back() }],
      );
    } catch (error) {
      // Backing out of the payment sheet is not a failure to announce.
      if (!isPaymentCancellation(error)) {
        const message = error instanceof Error ? error.message : 'Unable to complete purchase.';
        Alert.alert('License Purchase', message);
      }
    } finally {
      setBusyAction(null);
    }
  }, [canManagePayments, router, runRazorpayCheckout]);

  // Credits, on the same screen as the comparison: a shop that decides against
  // the licence for now still needs a way to keep scanning.
  const [rechargeOpen, setRechargeOpen] = useState(true);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const rechargeValue = Number(rechargeAmount || 0);
  const rechargeReady = Number.isFinite(rechargeValue) && rechargeValue >= MIN_RECHARGE;

  const handleRecharge = useCallback(async () => {
    if (!canManagePayments) {
      Alert.alert('Recharge Credits', 'Only the shop owner can buy credits.');
      return;
    }
    if (!rechargeReady) {
      Alert.alert('Recharge Credits', `Minimum purchase of ₹${MIN_RECHARGE} credits is allowed.`);
      return;
    }

    setBusyAction('recharge');
    try {
      assertRazorpayReady();
      const order = await createCreditRechargeOrder(rechargeValue);
      await runRazorpayCheckout(order);
      setRechargeAmount('');
      await loadOverview();
      Alert.alert('Recharge Credits', `₹${rechargeValue} of credits has been added.`);
    } catch (error) {
      if (!isPaymentCancellation(error)) {
        Alert.alert(
          'Recharge Credits',
          friendlyServerMessage(error, 'The recharge could not be completed.'),
        );
      }
    } finally {
      setBusyAction(null);
    }
  }, [canManagePayments, loadOverview, rechargeReady, rechargeValue, runRazorpayCheckout]);

  const purchaseState = useMemo(() => toPurchaseState(overview), [overview]);
  const displayPrice = rupees(overview?.applicationPrice || 12000);
  const bonusCredits = overview?.purchasedBonusCreditsConfigured || 1000;
  const trialDays = overview?.trialDaysConfigured || 7;
  const trialCredits = overview?.freeTrialCreditsConfigured || overview?.trialCredits || 10;
  const isPurchased = purchaseState === 'PERMANENT';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <ChevronLeft size={18} color={Colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.headerTitle}>Subscription</Text>
        </View>

        {!allowed || loading || purchaseState === 'LOADING' ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <View style={styles.contentWrap}>
            <View style={styles.hero}>
              <Text style={styles.title}>Unlock Full Access</Text>
              <Text style={styles.subtitle}>
                {isPurchased
                  ? 'You already own lifetime access.'
                  : 'Compare your current plan against lifetime access.'}
              </Text>
            </View>

            {isPurchased ? (
              <View style={styles.purchasedNotice}>
                <Check size={13} strokeWidth={3} color={Colors.successText} />
                <Text style={styles.purchasedNoticeText}>Already Purchased</Text>
              </View>
            ) : null}

            <View style={styles.compareShadow}>
              <View style={styles.compareRow}>
                {/* Free trial — what they have now */}
                <GradientView
                  colors={TRIAL_PANEL_GRADIENT}
                  forceGradient
                  sheen={0}
                  style={styles.panel}
                >
                  <Text style={styles.trialHeading}>Free Trial</Text>
                  <View style={styles.featureList}>
                    <Feature text={`${trialDays} day free trial`} tone="trial" />
                    <Feature text={`Free ${trialCredits} credits`} tone="trial" />
                    <Feature text="1 GST (Unlimited Users)" tone="trial" />
                    <Feature text="Admin Control live rates" tone="trial" />
                    <Feature text="Pay per scan" tone="trial" />
                    <Feature text="24×7 Customer Agent" tone="trial" />
                    <Feature text="Credit recharge when low" tone="trial" />
                  </View>
                </GradientView>

                <View style={styles.divider} />

                {/* Paid licence */}
                <GradientView
                  colors={PREMIUM_PANEL_GRADIENT}
                  forceGradient
                  sheen={0}
                  style={styles.panel}
                >
                  <Text
                    style={styles.paidHeading}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    Subscription
                  </Text>
                  <View style={styles.featureList}>
                    <Feature text="Life time access" tone="paid" />
                    <Feature text={`Free ${bonusCredits} Credits`} tone="paid" />
                    <Feature text="+ Everything in Free trial" tone="paid" />
                    {/* GST is charged on top, so the figure says so rather
                        than reading as the whole of what is due. */}
                    {/* The price on its own line; "+ GST" moves down under it
                        with the one-time note, at the shop's asking. */}
                    <Feature text={displayPrice} note="Plus GST" sub="(one time purchase)" tone="paid" />
                  </View>
                  <Pressable
                    disabled={busyAction === 'purchase' || isPurchased}
                    onPress={handlePurchase}
                    style={[
                      styles.purchaseBtn,
                      styles.panelAction,
                      (busyAction === 'purchase' || isPurchased) && styles.btnDisabled,
                    ]}
                  >
                    <Text style={styles.purchaseBtnText}>
                      {isPurchased
                        ? 'Already Purchased'
                        : busyAction === 'purchase'
                          ? 'Processing…'
                          : 'Purchase Now'}
                    </Text>
                  </Pressable>
                </GradientView>

                {/* Sits exactly over the seam between the two panels. */}
                <View style={styles.orBadge} pointerEvents="none">
                  <Text style={styles.orText}>OR</Text>
                </View>
              </View>
            </View>

            <Text style={styles.footnote}>
              One-time payment · No recurring charges · Instant activation
            </Text>

            <Text style={styles.sectionHeading}>Need More Credits?</Text>
            <View style={styles.rechargeCard}>
              <Pressable
                onPress={() => setRechargeOpen((open) => !open)}
                style={styles.rechargeHeader}
                accessibilityRole="button"
              >
                <Text style={styles.rechargeTitle}>Recharge Credits</Text>
                {rechargeOpen ? (
                  <ChevronUp size={18} color={Colors.textMuted} />
                ) : (
                  <ChevronDown size={18} color={Colors.textMuted} />
                )}
              </Pressable>

              {rechargeOpen ? (
                <View style={styles.rechargeBody}>
                  <Text style={styles.rechargeLabel}>Enter Credit amount</Text>
                  <Text style={styles.rechargeHint}>
                    Minimum purchase of ₹{MIN_RECHARGE} credits is allowed
                  </Text>

                  <View style={styles.amountField}>
                    <Text style={styles.amountPrefix}>₹</Text>
                    <TextInput
                      value={rechargeAmount}
                      onChangeText={(text) => setRechargeAmount(text.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={7}
                      placeholderTextColor={Colors.placeholder}
                      style={styles.amountInput}
                      accessibilityLabel="Credit amount"
                    />
                  </View>

                  <View style={styles.quickRow}>
                    {QUICK_AMOUNTS.map((amount) => (
                      <Pressable
                        key={amount}
                        onPress={() => setRechargeAmount(String(amount))}
                        style={[
                          styles.quickPill,
                          rechargeValue === amount && styles.quickPillActive,
                        ]}
                      >
                        <Text style={styles.quickPillText}>+₹{amount}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    onPress={handleRecharge}
                    disabled={busyAction !== null || !rechargeReady}
                    style={[styles.rechargeBtn, (busyAction !== null || !rechargeReady) && styles.btnDisabled]}
                  >
                    <Text style={styles.rechargeBtnText}>
                      {busyAction === 'recharge' ? 'Processing…' : 'Recharge Now'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

type FeatureProps = {
  text: string;
  sub?: string;
  /** A bold line under the text, above `sub` — "+ GST" under the price. */
  note?: string;
  tone: 'trial' | 'paid';
};

function Feature({ text, sub, note, tone }: FeatureProps) {
  const paid = tone === 'paid';
  return (
    <View style={styles.featureRow}>
      <Check
        size={14}
        color={paid ? Colors.white : Colors.textPrimary}
        strokeWidth={3}
        style={styles.featureCheck}
      />
      <View style={styles.featureTextWrap}>
        <Text
          style={[
            styles.featureText,
            paid && styles.featureTextPaid,
            sub && styles.featurePrice,
          ]}
        >
          {text}
        </Text>
        {note ? (
          <Text style={[styles.featureText, paid && styles.featureTextPaid, styles.featureNote]}>{note}</Text>
        ) : null}
        {sub ? <Text style={styles.featureSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compareShadow: {
    borderRadius: 22,
    shadowColor: '#15120D',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  compareRow: {
    flexDirection: 'row',
    position: 'relative',
    borderRadius: 22,
    overflow: 'hidden',
  },
  // Pins each panel's button to the bottom, so the two line up whatever
  // number of bullets sits above them.
  panelAction: { marginTop: 'auto' },
  panel: {
    flex: 1,
    minWidth: 0,
    minHeight: 330,
    paddingVertical: 34,
    paddingHorizontal: 18,
    gap: 18,
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.16)',
    zIndex: 2,
  },
  trialHeading: {
    fontFamily: Fonts.display,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  paidHeading: {
    fontFamily: Fonts.display,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: Colors.white,
    width: '100%',
  },
  purchaseBtn: {
    height: 46,
    backgroundColor: Colors.white,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 9,
    elevation: 5,
  },
  purchaseBtnText: { fontSize: 13, fontWeight: '800', color: Colors.brandDeep },
  orBadge: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -17,
    marginTop: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    elevation: 6,
    shadowColor: '#15120D',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  orText: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary },
  featureTextWrap: { flex: 1 },
  featureTextPaid: { color: Colors.white },
  featurePrice: { fontSize: 18, lineHeight: 22, fontWeight: '900' },
  featureNote: { fontSize: 14, lineHeight: 18, fontWeight: '800', marginTop: 2 },
  featureSub: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  // Stated inline above the panels, so the plan itself stays readable.
  purchasedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 12,
    borderRadius: Radius.button,
    backgroundColor: Colors.successBg,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  purchasedNoticeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.successText,
  },

  footnote: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: { flex: 1 },
  screen: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: 8,
    paddingBottom: 96,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 22,
    marginBottom: 10,
  },
  rechargeCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.tile,
    paddingHorizontal: Spacing.lg,
  },
  rechargeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rechargeTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  rechargeBody: { paddingBottom: 18, gap: 10 },
  rechargeLabel: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  rechargeHint: { fontSize: 11.5, color: Colors.accentGold, marginTop: -6 },
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 14,
    height: 46,
  },
  amountPrefix: { fontSize: 15, fontWeight: '700', color: Colors.textMuted },
  amountInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    padding: 0,
  },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
  },
  quickPillActive: { borderColor: Colors.accentGold, borderWidth: 1.5 },
  quickPillText: { fontSize: 12.5, fontWeight: '800', color: Colors.accentGold },
  rechargeBtn: {
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryButton,
    marginTop: 4,
  },
  rechargeBtnText: { fontSize: 14, fontWeight: '800', color: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerStateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 10,
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  doneSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  contentWrap: {
    width: '100%',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 21,
    lineHeight: 26,
    color: Colors.textPrimary,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 17,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  priceBlock: {
    marginTop: 8,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 36,
    lineHeight: 40,
    color: Colors.primary,
    fontWeight: '800',
  },
  priceCaption: {
    marginTop: 2,
    fontSize: 13,
    color: '#645233',
    fontWeight: '600',
  },
  featureList: {
    gap: 15,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  featureCheck: {
    marginTop: 2,
  },
  featureText: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  ctaWrap: {
    marginTop: 6,
    gap: 8,
  },
  ctaPrice: {
    fontSize: 13,
    color: '#5A4A2D',
    textAlign: 'center',
    fontWeight: '700',
  },
  primaryBtn: {
    height: 48,
    borderRadius: Radius.button,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
});
