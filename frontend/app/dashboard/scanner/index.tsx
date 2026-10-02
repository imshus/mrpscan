import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { ScreenBackHeader } from '@/components/scanner/ScreenBackHeader';
import { MessagePopup } from '@/components/settings/MessagePopup';
import { useAuthStore } from '@/store/authStore';
import { useScannerStore } from '@/store/scannerStore';
import { ApiError } from '@/utils/apiClient';
import { fetchSubscriptionOverview, MIN_SCAN_BALANCE, startFreeTrial } from '@/utils/subscriptionApi';
import type { SubscriptionOverview } from '@/types/subscription';

const PURCHASE_ROUTE = '/dashboard/purchase-license' as Href;
/** The same screen, opened on its Recharge Credits card. */
const RECHARGE_ROUTE = {
  pathname: '/dashboard/purchase-license',
  params: { recharge: '1' },
} as unknown as Href;

export default function ScannerScreen() {
  const router = useRouter();
  const userRole = useAuthStore((s) => s.userRole);
  const [initializing, setInitializing] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  // Set once the shop has answered a popup, so it does not sit over the
  // screen the popup sent them to. Cleared when this screen is back in front.
  const [popupHidden, setPopupHidden] = useState(false);
  const resetScanSession = useScannerStore((s) => s.resetScanSession);
  const setScanSessionBootstrapping = useScannerStore((s) => s.setScanSessionBootstrapping);
  const isOwner = userRole === 'business';

  // Trial over: the server's scanner flag is off and a trial has been used —
  // its end stamp, or failing that its start date (a licence put back to no
  // licence by hand can lose the stamp but keeps the start). Out of credits:
  // the licence is fine but the wallet is empty — the server would refuse
  // the scan (NO_CREDITS_AVAILABLE) a few screens in, so the shop is told
  // here, at the tap, and sent to recharge instead.
  const trialUsed = Boolean(overview?.trialExpiredAt || overview?.trialStartDate);
  const trialExpired =
    isOwner && Boolean(overview && !overview.scannerEnabled && trialUsed);
  // "No credits left" as soon as the wallet cannot pay for one more scan
  // (0.74 unless the server says otherwise), not only at 0: a scan is billed
  // once it is done and only if the wallet covers the whole charge, so a
  // wallet of 0.51 used to run scans it could never pay for.
  const creditsLow = Boolean(
    overview
      && Number(overview.creditBalance || 0) <= Number(overview.minScanBalance ?? MIN_SCAN_BALANCE),
  );
  const outOfCredits = isOwner && Boolean(overview && overview.scannerEnabled && creditsLow);

  const canUseScanner = isOwner
    ? Boolean(overview && overview.scannerEnabled && !outOfCredits)
    : true;

  const loadOverview = useCallback(async () => {
    setInitializing(true);
    try {
      const data = await fetchSubscriptionOverview();
      setOverview(data);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to load subscription status.';
      Alert.alert('Scanner Access', message);
    } finally {
      setInitializing(false);
    }
  }, []);

  // Read again every time this screen comes to the front, not only when it
  // mounts: the popups send the shop to the purchase screen, and when it
  // comes back with a plan or with credits the scanner must open, not ask
  // the same thing again.
  useFocusEffect(
    useCallback(() => {
      setPopupHidden(false);
      if (!isOwner) {
        setInitializing(false);
        return;
      }
      void loadOverview();
    }, [isOwner, loadOverview]),
  );

  useEffect(() => {
    let active = true;
    const prepareScanner = () => {
      if (!canUseScanner || !active) return;
      // Scanner entry is only a UI lifecycle event. A billable scanId is created
      // later, when the user confirms image(s) for upload/analysis.
      resetScanSession();
      setScanSessionBootstrapping(false);
      router.replace('/dashboard/scanner/barcode' as Href);
    };

    prepareScanner();

    return () => {
      active = false;
      setScanSessionBootstrapping(false);
    };
  }, [
    canUseScanner,
    router,
    resetScanSession,
    setScanSessionBootstrapping,
  ]);

  const handlePrimaryAction = async () => {
    if (!overview || !isOwner) {
      return;
    }

    setActionLoading(true);
    try {
      if (overview.status === 'NO_LICENSE' && !overview.trialExpiredAt) {
        await startFreeTrial();
      } else {
        router.push(PURCHASE_ROUTE);
        return;
      }
      await loadOverview();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to update subscription status.';
      Alert.alert('Scanner Access', message);
    } finally {
      setActionLoading(false);
    }
  };

  const showBlockedState = !initializing && !canUseScanner;

  const isTrialExpired = Boolean(overview?.trialExpiredAt);

  // What the tap on Scan gets when it cannot go through: the reason and the
  // one place that fixes it. A trial never started keeps the card below.
  const popup = trialExpired
    ? {
        title: 'Free trial expired',
        // Trial over and credits low (the usual case: the wallet is emptied
        // when the trial ends) says both; either way the one fix is the
        // licence, never a recharge, which a shop off its trial cannot buy.
        message: creditsLow
          ? 'Your free trial has expired and your credits are low. Please purchase a license to continue scanning.'
          : 'Your free trial has expired. Please purchase a license to continue scanning.',
        action: 'Purchase License',
        route: PURCHASE_ROUTE,
      }
    : outOfCredits
      ? {
          // "Low", not "over": at 0.51 Home still says a credit is left, and
          // both are true — there is some, but not enough for one scan.
          title: 'Low credits',
          message: 'Your credits are too low for a scan. Please recharge to continue scanning.',
          action: 'Recharge Credits',
          route: RECHARGE_ROUTE,
        }
      : null;

  const leave = () => {
    setPopupHidden(true);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/dashboard' as Href);
    }
  };

  const goTo = (route: Href) => {
    setPopupHidden(true);
    router.push(route);
  };

  const bannerTitle = isTrialExpired
    ? 'Purchase Application'
    : 'Start your FREE Trial Today';

  const bannerSubtitle = isTrialExpired
    ? 'Trial expired. Purchase application to continue scanning.'
    : 'Scanner access will unlock instantly after starting your free trial.';

  const primaryActionLabel = isTrialExpired ? 'Purchase Application' : 'Start Free Trial';

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="bg-white" edges={['top']}>
        <ScreenBackHeader />
      </SafeAreaView>

      <View className="flex-1 items-center justify-center bg-white px-6">
        {initializing ? <ActivityIndicator size="large" color="#D9291F" /> : null}

        {showBlockedState && !popup ? (
          <View className="w-full rounded-2xl border border-[#E8DBC2] bg-[#FFF7E8] p-5">
            <Text className="text-[24px] font-extrabold text-[#3F2F1C]">{bannerTitle}</Text>
            <Text className="mt-2 text-[14px] leading-5 text-[#675437]">{bannerSubtitle}</Text>
            <Text className="mt-3 text-[13px] text-[#675437]">
              Credits Remaining: {Number(overview?.creditBalance || 0).toFixed(2)}
            </Text>

            {isOwner ? (
              <Pressable
                onPress={handlePrimaryAction}
                disabled={actionLoading}
                className="mt-5 items-center rounded-xl bg-[#B8860B] py-3"
              >
                <Text className="text-[14px] font-bold text-white">
                  {actionLoading ? 'Please wait...' : primaryActionLabel}
                </Text>
              </Pressable>
            ) : (
              <Text className="mt-5 text-[13px] font-medium text-[#675437]">
                Contact your organization owner to activate scanner access.
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {/* Held back while the overview is being read again: coming back
          from the purchase screen, the old answer must not show for the
          length of the round trip. */}
      <MessagePopup
        message={popup && !popupHidden && !initializing ? popup.message : null}
        title={popup?.title}
        tone="error"
        icon="alert"
        actionLabel={popup?.action}
        onAction={() => {
          if (popup) goTo(popup.route);
        }}
        onDismiss={leave}
      />

      <BottomNav />
    </View>
  );
}
