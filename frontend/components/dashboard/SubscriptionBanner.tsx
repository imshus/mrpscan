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

/**
 * Whole days left on the trial, or 0 for one that runs out today.
 *
 * Rounded from the milliseconds in one step. Rounding the hours up and then
 * the days up again turned any sliver over a whole day into a whole extra
 * day, so a seven-day trial read as eight the moment it started — the phone's
 * clock is never exactly the server's.
 */
function trialDaysLeft(
  trialEndDate: string | null | undefined,
  fallbackDays: number,
): number {
  if (trialEndDate) {
    const endsAt = new Date(trialEndDate).getTime();
    if (Number.isFinite(endsAt)) {
      const diffMs = endsAt - Date.now();
      if (diffMs <= 0) return 0;
      if (diffMs / (60 * 60 * 1000) <= 24) return 0;
      return Math.round(diffMs / (24 * 60 * 60 * 1000));
    }
  }
  return Math.max(0, Math.ceil(Number(fallbackDays || 0)));
}

/** "Free trial ends in 7 days" — the whole sentence, as the design has it. */
function buildTrialSentence(days: number): string {
  if (days <= 0) return 'Free trial ends today';
  return `Free trial ends in ${days} day${days === 1 ? '' : 's'}`;
}

export function SubscriptionBanner({
  licenseStatus,
  trialDaysRemaining = 0,
  trialEndDate,
  trialDays = 7,
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

  // A running trial says the whole thing on one line — "Free trial ends in 7
  // days" — rather than a heading over a number, which read as two unrelated
  // facts stacked on each other.
  const headline = useMemo(() => {
    if (hasLicence) return 'Your subscription is active';
    if (trialEnded) return 'Free trial ended';
    if (showTrialOnboarding) return 'Start your free trial';
    return buildTrialSentence(trialDaysLeft(trialEndDate, trialDaysRemaining));
  }, [hasLicence, showTrialOnboarding, trialDaysRemaining, trialEndDate, trialEnded]);

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
    if (trialEnded) return null;
    if (showTrialOnboarding) {
      const days = Math.max(1, Math.round(Number(trialDays || 7)));
      return `${days} day${days === 1 ? '' : 's'} free`;
    }
    // The headline already carries the days, so a second line would repeat it.
    return null;
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
        // The shop's reference draws this one surface as a gradient — light
        // coral at the top-left corner to deep red at the bottom-right,
        // measured off the image at (223,146,134) and (172,75,60), which is
        // trial1 to trial3 — while every other card stays flat as they asked
        // earlier. The light sheen is the mockup's own for terracotta cards.
        forceGradient
        sheen={0.16}
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