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
import { Colors, Radius, Spacing } from '@/constants/theme';
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

function isPaymentCancellation(error: unknown): boolean {
  const raw = error as { code?: unknown; description?: unknown; message?: unknown } | null;
  // Razorpay's own cancellation code.
  if (raw?.code === 0 || raw?.code === 'PAYMENT_CANCELLED') return true;

  const text = `${String(raw?.description ?? '')} ${String(raw?.message ?? '')}`.toLowerCase();
  return text.includes('cancel') || text.includes('dismiss') || text.includes('user closed');
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
      // Backing out of the Razorpay sheet is a decision, not a failure, so it
      // does not get an error popup.
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <ChevronLeft size={22} color={Colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.headerTitle}>License Purchase</Text>
          <View style={styles.headerSpacer} />
        </View>

        {!allowed || loading || purchaseState === 'LOADING' ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <View style={styles.contentWrap}>
            {/* An active licence used to replace this whole page, which left the
                licence details unreadable once one had been bought. The notice
                sits above the page instead. */}
            {purchaseState === 'PERMANENT' ? (
              <View style={styles.activeNotice}>
                <Text style={styles.activeNoticeTitle}>Application License Active</Text>
                <Text style={styles.activeNoticeText}>
                  No purchase is required for this organization.
                </Text>
              </View>
            ) : null}

            <View>
              <Text style={styles.title}>Own Your MRP Scanner</Text>
              <Text style={styles.subtitle}>One-time application license</Text>
            </View>

            <View style={styles.priceBlock}>
              <Text style={styles.priceValue}>{displayPrice}</Text>
              <Text style={styles.priceCaption}>One-time purchase</Text>
            </View>

            <View style={styles.featureList}>
              <Feature text="One-time application license" />
              <Feature text="Lifetime application validity" />
              <Feature text="Pay per scan usage" />
              <Feature text={`${rupees(bonusCredits)} wallet credits included`} />
              <Feature text="Credit recharge facility available" />
            </View>

            <View style={styles.ctaWrap}>
              <Text style={styles.ctaPrice}>{displayPrice} One-Time Purchase</Text>
              <Pressable
                disabled={busy || purchaseState === 'PERMANENT'}
                onPress={handlePurchase}
                style={[
                  styles.primaryBtn,
                  (busy || purchaseState === 'PERMANENT') && styles.btnDisabled,
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {busy
                    ? 'Processing...'
                    : purchaseState === 'PERMANENT'
                      ? 'Already Purchased'
                      : 'Purchase Now'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

type FeatureProps = {
  text: string;
};

function Feature({ text }: FeatureProps) {
  return (
    <View style={styles.featureRow}>
      <Check size={15} color={Colors.primary} strokeWidth={2.5} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
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
  activeNotice: {
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  activeNoticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  activeNoticeText: {
    fontSize: 12,
    color: Colors.textSecondary,
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
