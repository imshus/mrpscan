import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

import { GradientView } from '@/components/ui/GradientView';
import { Gradients } from '@/constants/theme';
import type { SubscriptionOverview } from '@/types/subscription';

type BannerStatus = SubscriptionOverview['status'];

type Props = {
  licenseStatus: BannerStatus;
  trialDaysRemaining?: number;
  trialHoursRemaining?: number;
  trialEndDate?: string | null;
  onStartTrial: () => void;
  onPurchase: () => void;
  trialExpiredAt?: string | null;
  loading?: boolean;
};

function buildTrialCountdownLabel(
  trialEndDate: string | null | undefined,
  fallbackDays: number,
  fallbackHours: number,
): string {
  if (trialEndDate) {
    const endsAt = new Date(trialEndDate).getTime();
    if (Number.isFinite(endsAt)) {
      const diffMs = endsAt - Date.now();
      if (diffMs <= 0) {
        return 'Free trial ends today';
      }

      const totalHours = Math.ceil(diffMs / (60 * 60 * 1000));
      if (totalHours <= 24) {
        return 'Free trial ends today';
      }

      const totalDays = Math.ceil(totalHours / 24);
      return `Free trial ends in ${totalDays} day${totalDays === 1 ? '' : 's'}`;
    }
  }

  const days = Math.max(0, Math.ceil(Number(fallbackDays || 0)));
  const hours = Math.max(0, Math.ceil(Number(fallbackHours || 0)));
  if (days > 0) return `Free trial ends in ${days} day${days === 1 ? '' : 's'}`;
  if (hours > 0) return 'Free trial ends today';
  return 'Free trial ends today';
}

export function SubscriptionBanner({
  licenseStatus,
  trialDaysRemaining = 0,
  trialHoursRemaining = 0,
  trialEndDate,
  onStartTrial,
  onPurchase,
  trialExpiredAt,
  loading = false,
}: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const liftAnim = useRef(new Animated.Value(8)).current;

  const showTrialOnboarding = licenseStatus === 'NO_LICENSE' && !trialExpiredAt;
  // A live licence still needs a way to buy the next one, so the tile stays on
  // the home screen for every status — only its wording changes.
  const hasLicence =
    licenseStatus === 'PERMANENT_LICENSE' || licenseStatus === 'PURCHASED';

  useEffect(() => {
    fadeAnim.setValue(0);
    liftAnim.setValue(8);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(liftAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, liftAnim, licenseStatus]);

  const headline = useMemo(() => {
    if (showTrialOnboarding) return 'Start Your 10-Day Free Trial';
    if (hasLicence) return 'Your licence is active';
    if (trialExpiredAt) {
      return 'Free trial has ended';
    }
    return buildTrialCountdownLabel(trialEndDate, trialDaysRemaining, trialHoursRemaining);
  }, [
    showTrialOnboarding,
    hasLicence,
    trialDaysRemaining,
    trialEndDate,
    trialExpiredAt,
    trialHoursRemaining,
  ]);

  const actionLabel = showTrialOnboarding ? 'Start Free Trial →' : 'Purchase License →';
  const handlePress = showTrialOnboarding ? onStartTrial : onPurchase;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { opacity: fadeAnim, transform: [{ translateY: liftAnim }] },
      ]}
    >
      <GradientView
        colors={Gradients.trial}
        borderRadius={16}
        sheen={0.16}
        topHighlight={0.22}
        style={styles.tile}
      >
        <Text numberOfLines={2} style={styles.headline}>
          {headline}
        </Text>
        <Pressable disabled={loading} onPress={handlePress} style={styles.cta}>
          <Text style={styles.ctaText}>{loading ? 'Please wait…' : actionLabel}</Text>
        </Pressable>
      </GradientView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#3C140F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 6,
  },
  headline: {
    fontSize: 12.5,
    lineHeight: 16.25,
    color: 'rgba(255,255,255,0.96)',
    fontWeight: '700',
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ctaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
