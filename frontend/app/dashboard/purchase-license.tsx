import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientView } from '@/components/ui/GradientView';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';
import { useAuthStore } from '@/store/authStore';
import type { SubscriptionOverview } from '@/types/subscription';
import {
  createApplicationPurchaseOrder,
  fetchSubscriptionOverview,
  markPaymentFailure,
  verifyPayment,
} from '@/utils/subscriptionApi';
import Constants from 'expo-constants';

type RazorpayModule = {
  open: (options: Record<string, unknown>) => Promise<{
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }>;
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

/**
 * True when the checkout closed because the user backed out.
 *
 * Razorpay reports this like any other failure, so it has to be told apart
 * from a real problem: dismissing the sheet should not raise an alert saying
 * the purchase could not be completed.
 */
function isPaymentCancellation(error: unknown): boolean {
  const raw = error as { code?: unknown; description?: unknown; message?: unknown } | null;
  // Razorpay's own cancellation code.
  if (raw?.code === 0 || raw?.code === 'PAYMENT_CANCELLED') return true;

  const text = `${String(raw?.description ?? '')} ${String(raw?.message ?? '')}`.toLowerCase();
  return text.includes('cancel') || text.includes('dismiss') || text.includes('user closed');
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

/** Exact gradients from mrpscan-design-mockup/styles.css. */
const TRIAL_PANEL_GRADIENT = ['#F5EFE0', '#DDD0B0', '#C2B28C'];
const PREMIUM_PANEL_GRADIENT = ['#E6947F', '#C25F4E', '#8F2F22'];

export default function PurchaseLicenseScreen() {
  const router = useRouter();
  const allowed = useRequireSettingsAccess('subscription');
  const userRole = useAuthStore((s) => s.userRole);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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

    try {
      const payment = await RazorpayCheckout.open({
        key,
        amount: order.amountInPaise,
        currency: 'INR',
        order_id: order.orderId,
        name: 'MRP Scanner',
        description: 'Application License Purchase',
        theme: { color: Colors.primary },
      });

      await verifyPayment(payment.razorpay_order_id, payment.razorpay_payment_id, payment.razorpay_signature);
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : 'Payment cancelled or failed.';
      // The order is still closed out on the server, cancelled or not.
      await markPaymentFailure(order.orderId, null, failureMessage);
      throw error;
    }
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!canManagePayments) {
      Alert.alert('License Purchase', 'Only business account can purchase application license.');
      return;
    }

    setBusy(true);
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
      setBusy(false);
    }
  }, [canManagePayments, router, runRazorpayCheckout]);

  const purchaseState = useMemo(() => toPurchaseState(overview), [overview]);
  const displayPrice = rupees(overview?.applicationPrice || 12000);
  const bonusCredits = overview?.purchasedBonusCreditsConfigured || 1000;
  const trialDays = overview?.trialDaysConfigured || 10;
  const trialCredits = overview?.freeTrialCreditsConfigured || overview?.trialCredits || 10;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.screen}>
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
        ) : purchaseState === 'PERMANENT' ? (
          <View style={styles.centerStateWrap}>
            <Text style={styles.doneTitle}>Application License Active</Text>
            <Text style={styles.doneSubtitle}>No purchase is required for this organization.</Text>
            <Pressable onPress={() => router.back()} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Go Back</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.contentWrap}>
            <View style={styles.hero}>
              <Text style={styles.title}>Unlock Full Access</Text>
              <Text style={styles.subtitle}>Compare your current plan against lifetime access.</Text>
            </View>

            <View style={styles.compareShadow}>
              <View style={styles.compareRow}>
                {/* Free trial — what they have now */}
                <GradientView
                  colors={TRIAL_PANEL_GRADIENT}
                  sheen={0.6}
                  style={styles.panel}
                >
                  <Text style={styles.trialHeading}>Free Trial</Text>
                  <View style={styles.featureList}>
                    <Feature text={`${trialDays} day free trial`} tone="trial" />
                    <Feature text={`Free ${trialCredits} credits`} tone="trial" />
                  </View>
                  <Pressable
                    onPress={() => router.replace('/dashboard')}
                    style={[styles.keepBtn, styles.panelAction]}
                  >
                    <Text style={styles.keepBtnText}>Keep Using</Text>
                  </Pressable>
                </GradientView>

                <View style={styles.divider} />

                {/* Paid licence */}
                <GradientView
                  colors={PREMIUM_PANEL_GRADIENT}
                  sheen={0.3}
                  style={styles.panel}
                >
                  <Text style={styles.paidHeading}>Subscription</Text>
                  <View style={styles.featureList}>
                    <Feature text={displayPrice} sub="(one time purchase)" tone="paid" />
                    <Feature text="Lifetime application validity" tone="paid" />
                    <Feature text="Pay per scan usage" tone="paid" />
                    <Feature text={`${rupees(bonusCredits)} wallet credits included`} tone="paid" />
                    <Feature text="Credit recharge when low" tone="paid" />
                  </View>
                  <Pressable
                    disabled={busy}
                    onPress={handlePurchase}
                    style={[styles.purchaseBtn, styles.panelAction, busy && styles.btnDisabled]}
                  >
                    <Text style={styles.purchaseBtnText}>
                      {busy ? 'Processing…' : 'Purchase Now'}
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
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

type FeatureProps = {
  text: string;
  sub?: string;
  tone: 'trial' | 'paid';
};

function Feature({ text, sub, tone }: FeatureProps) {
  const paid = tone === 'paid';
  return (
    <View style={styles.featureRow}>
      <Check
        size={14}
        color={paid ? Colors.white : Colors.metalGold}
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
    paddingVertical: 26,
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
  },
  keepBtn: {
    height: 46,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
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
  featurePrice: { fontSize: 16, lineHeight: 19, fontWeight: '900' },
  featureSub: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
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
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: 8,
    paddingBottom: 96,
  },
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
