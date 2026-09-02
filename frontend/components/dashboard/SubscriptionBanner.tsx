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
  /** Still passed by the dashboard; the day count no longer needs it. */
  trialHoursRemaining?: number;
  trialEndDate?: string | null;
  /** Configured trial length (days) — shown before the trial has started. */
  trialDays?: number;
  onStartTrial: () => void;
  onPurchase: () => void;
  trialExpiredAt?: string | null;
  creditBalance?: number;
  loading?: boolean;
};

function buildDaysLeftLabel(
  trialEndDate: string | null | undefined,
  fallbackDays: number,
): string {
  if (trialEndDate) {
    const endsAt = new Date(trialEndDate).getTime();
    if (Number.isFinite(endsAt)) {
      const diffMs = endsAt - Date.now();
      if (diffMs <= 0) return 'Ends today';
      const totalHours = Math.ceil(diffMs / (60 * 60 * 1000));
      if (totalHours <= 24) return 'Ends today';
      const totalDays = Math.ceil(totalHours / 24);
      return `${totalDays} day${totalDays === 1 ? '' : 's'} left`;
    }
  }
  const days = Math.max(0, Math.ceil(Number(fallbackDays || 0)));
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`;
  return 'Ends today';
}

export function SubscriptionBanner({
  licenseStatus,
  trialDaysRemaining = 0,
  trialEndDate,
  trialDays = 10,
  onStartTrial,
  onPurchase,
  trialExpiredAt,
  creditBalance,
  loading = false,
}: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const liftAnim = useRef(new Animated.Value(8)).current;

  const showTrialOnboarding = licenseStatus === 'NO_LICENSE' && !trialExpiredAt;
  // A bought licence used to remove this tile, and with it the home screen's
  // only route to the subscription page. The tile stays for every status now;
  // only its wording and destination change.
  const hasLicence =
    licenseStatus === 'PERMANENT_LICENSE' || licenseStatus === 'PURCHASED';
  const trialEnded = Boolean(trialExpiredAt) || licenseStatus === 'EXPIRED';

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

  const headline = hasLicence ? 'Your subscription is active' : 'Buy premium';

  const actionLabel = showTrialOnboarding ? 'Start Free Trial →' : 'Purchase License →';
  const handlePress = showTrialOnboarding ? onStartTrial : onPurchase;

  // Second line carries the number that matters for the state: credits for a
  // held licence (it is billed per scan), days left for a trial (or the full
  // trial length before it starts), and a plain "ended" once the trial is over.
  const detailLabel = useMemo(() => {
    if (hasLicence) {
      return typeof creditBalance === 'number'
        ? `${Math.max(0, Math.round(creditBalance)).toLocaleString('en-IN')} credits left`
        : null;
    }
    if (trialEnded) return 'Free trial ended';
    if (showTrialOnboarding) {
      const days = Math.max(1, Math.round(Number(trialDays || 10)));
      return `${days} day${days === 1 ? '' : 's'} left`;
    }
    return buildDaysLeftLabel(trialEndDate, trialDaysRemaining);
  }, [
    creditBalance,
    hasLicence,
    showTrialOnboarding,
    trialDays,
    trialDaysRemaining,
    trialEndDate,
    trialEnded,
  ]);

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
        style={styles.tile}
      >
        <Text numberOfLines={2} style={styles.headline}>
          {headline}
        </Text>
        {detailLabel ? (
          <Text numberOfLines={1} style={styles.detail}>
            {detailLabel}
          </Text>
        ) : null}
        {/* Nothing is left to buy or manage once a licence is held, so the
            tile reports the balance and offers no way through to a page. */}
        {hasLicence ? null : (
          <Pressable disabled={loading} onPress={handlePress} style={styles.cta}>
            <Text style={styles.ctaText}>{loading ? 'Please wait…' : actionLabel}</Text>
          </Pressable>
        )}
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
    borderColor: 'rgba(0,0,0,0.12)',
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
  detail: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: -2,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.18)',
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