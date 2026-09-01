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

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients, Radius, Spacing } from '@/constants/theme';
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

function rupees(value: number): string {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function toPurchaseState(overview: SubscriptionOverview | null): 'LOADING' | 'PERMANENT' | 'CAN_PURCHASE' {
  if (!overview) return 'LOADING';
  if (overview.status === 'PERMANENT_LICENSE' || overview.applicationPurchased) {
    return 'PERMANENT';
  }
  return 'CAN_PURCHASE';
}

/** Cream-to-tan wash behind the free-trial panel. */
const TRIAL_PANEL_GRADIENT = ['#F5EEDC', '#E3D6B4'];

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
      const message = error instanceof Error ? error.message : 'Unable to complete purchase.';
      Alert.alert('License Purchase', message);
    } finally {
      setBusy(false);
    }
  }, [canManagePayments, router, runRazorpayCheckout]);

  const purchaseState = useMemo(() => toPurchaseState(overview), [overview]);
  const displayPrice = rupees(overview?.applicationPrice || 12000);
  const bonusCredits = overview?.purchasedBonusCreditsConfigured || 1000;
  const trialDays = overview?.trialDaysConfigured || 10;
  const trialCredits = overview?.trialCredits || 10;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <ChevronLeft size={22} color={Colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.headerTitle}>Subscription</Text>
          <View style={styles.headerSpacer} />
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
            <Text style={styles.title}>Unlock Full Access</Text>
            <Text style={styles.subtitle}>
              Compare your current plan against{' '}
              <Text style={styles.subtitleAccent}>lifetime access</Text>.
            </Text>

            <View style={styles.compareRow}>
              {/* Free trial — what they have now */}
              <GradientView
                colors={TRIAL_PANEL_GRADIENT}
                borderRadius={18}
                style={styles.trialPanel}
              >
                <Text style={styles.trialHeading}>Free Trial</Text>
                <Feature text={`${trialDays} day free trial`} tone="trial" />
                <Feature text={`Free ${trialCredits} credits`} tone="trial" />
                <View style={styles.panelSpacer} />
                <Pressable
                  onPress={() => router.replace('/dashboard')}
                  style={styles.keepBtn}
                >
                  <Text style={styles.keepBtnText}>Keep Using</Text>
                </Pressable>
              </GradientView>

              {/* Paid licence */}
              <GradientView
                colors={Gradients.trial}
                borderRadius={18}
                sheen={0.16}
                topHighlight={0.22}
                style={styles.paidPanel}
              >
                <Text style={styles.paidHeading}>Subscription</Text>
                <Feature text={displayPrice} sub="(one time purchase)" tone="paid" />
                <Feature text="Lifetime application validity" tone="paid" />
                <Feature text="Pay per scan usage" tone="paid" />
                <Feature text={`${rupees(bonusCredits)} wallet credits included`} tone="paid" />
                <Feature text="Credit recharge when low" tone="paid" />
                <View style={styles.panelSpacer} />
                <Pressable
                  disabled={busy}
                  onPress={handlePurchase}
                  style={[styles.purchaseBtn, busy && styles.btnDisabled]}
                >
                  <Text style={styles.purchaseBtnText}>
                    {busy ? 'Processing…' : 'Purchase Now'}
                  </Text>
                </Pressable>
              </GradientView>

              {/* Sits over the seam between the two panels */}
              <View style={styles.orBadge} pointerEvents="none">
                <Text style={styles.orText}>OR</Text>
              </View>
            </View>

            <Text style={styles.footnote}>
              One-time payment · No recurring charges · Instant activation
            </Text>
          </View>
        )}
      </View>

      <BottomNav activeRoute="home" />
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
      <Check size={13} color={paid ? Colors.white : Colors.primary} strokeWidth={3} />
      <View style={styles.featureTextWrap}>
        <Text style={[styles.featureText, paid && styles.featureTextPaid]}>{text}</Text>
        {sub ? <Text style={styles.featureSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Two panels sharing an edge, with an OR badge sitting over the seam.
  compareRow: { flexDirection: 'row', marginTop: 18, position: 'relative' },
  subtitleAccent: { color: Colors.primary, fontWeight: '600' },
  trialPanel: {
    flex: 1,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    paddingVertical: 18,
    paddingLeft: 16,
    paddingRight: 22,
    gap: 10,
  },
  paidPanel: { flex: 1.06, paddingVertical: 18, paddingHorizontal: 16, gap: 10 },
  trialHeading: { fontSize: 17, fontWeight: '700', color: Colors.brandDeep, marginBottom: 2 },
  paidHeading: { fontSize: 17, fontWeight: '700', color: Colors.white, marginBottom: 2 },
  panelSpacer: { flex: 1, minHeight: 12 },
  keepBtn: {
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
  },
  keepBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  purchaseBtn: {
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
  },
  purchaseBtnText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  orBadge: {
    position: 'absolute',
    left: '46%',
    top: '44%',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  orText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  featureTextWrap: { flex: 1 },
  featureTextPaid: { color: Colors.white },
  featureSub: { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  footnote: {
    marginTop: 16,
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 94,
  },
  header: {
    paddingTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSpacer: {
    width: 32,
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
    flex: 1,
    marginTop: 14,
    backgroundColor: '#FFF9EF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#E6D7B8',
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 29,
    lineHeight: 33,
    color: '#201A11',
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6E5A3C',
    fontWeight: '600',
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
    gap: 8,
    marginTop: 2,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    color: '#2D2D2D',
    fontWeight: '600',
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
