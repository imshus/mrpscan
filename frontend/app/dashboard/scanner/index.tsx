import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { ScreenBackHeader } from '@/components/scanner/ScreenBackHeader';
import { useAuthStore } from '@/store/authStore';
import { useScannerStore } from '@/store/scannerStore';
import { ApiError } from '@/utils/apiClient';
import { fetchSubscriptionOverview, startFreeTrial } from '@/utils/subscriptionApi';
import type { SubscriptionOverview } from '@/types/subscription';

export default function ScannerScreen() {
  const router = useRouter();
  const userRole = useAuthStore((s) => s.userRole);
  const [initializing, setInitializing] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const resetScanSession = useScannerStore((s) => s.resetScanSession);
  const setScanSessionBootstrapping = useScannerStore((s) => s.setScanSessionBootstrapping);
  const isOwner = userRole === 'business';

  const canUseScanner = isOwner
    ? Boolean(
        overview
          && overview.scannerEnabled,
      )
    : true;

  const loadOverview = async () => {
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
  };

  useEffect(() => {
    if (!isOwner) {
      setInitializing(false);
      return;
    }
    void loadOverview();
  }, [isOwner]);

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
        router.push('/dashboard/purchase-license' as Href);
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

        {showBlockedState ? (
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

      <BottomNav activeRoute="scanner" scanButtonVariant="gold" />
    </View>
  );
}
