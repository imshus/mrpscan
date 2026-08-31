import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { SubscriptionBanner } from '@/components/dashboard/SubscriptionBanner';
import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients, Spacing } from '@/constants/theme';
import type { GoldRate, SupremeChanges, TaxSettings } from '@/types/rates';
import type { SubscriptionOverview } from '@/types/subscription';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/utils/apiClient';
import { formatKaratLabel, resolveMcxChangeValue } from '@/utils/goldRateUtils';
import { fetchGoldRates } from '@/utils/ratesApi';
import {
  fetchSubscriptionOverview,
  startFreeTrial,
} from '@/utils/subscriptionApi';
import { useMatricesStore } from '@/store/matricesStore';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import type { MatrixKey } from '@/constants/dashboardMatrices';

const CARAT_ORDER = ['22Kt', '20Kt', '18Kt', '14Kt', '9Kt'];

function sortGoldRates(rates: GoldRate[]): GoldRate[] {
  return [...rates].sort((a, b) => {
    const ai = CARAT_ORDER.indexOf(a.carat);
    const bi = CARAT_ORDER.indexOf(b.carat);
    if (ai === -1 && bi === -1) return a.carat.localeCompare(b.carat);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/** Champagne metallic badge showing one rate value + label (mockup .dash-rate-badge). */
function RateBadge({ value, label }: { value: string; label: string }) {
  return (
    <GradientView
      colors={Gradients.metallic}
      borderRadius={10}
      sheen={0.55}
      topHighlight={0.6}
      style={styles.rateBadge}
    >
      <Text style={styles.rateBadgeValue}>{value}</Text>
      <Text style={styles.rateBadgeLabel}>{label}</Text>
    </GradientView>
  );
}

/** Live day / date / time tile (mockup .dash-time-tile). */
function TimeTile() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const dayLabel = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'short' });
  const timeLabel = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <GradientView
      colors={Gradients.metallic}
      borderRadius={16}
      sheen={0.55}
      topHighlight={0.6}
      style={styles.timeTile}
    >
      <Text style={styles.timeDay}>{dayLabel}</Text>
      <Text style={styles.timeDate}>
        {now.getDate()} {monthLabel}
      </Text>
      <Text style={styles.timeClock}>{timeLabel}</Text>
    </GradientView>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const authUserRole = useAuthStore((s) => s.userRole);
  const [loading, setLoading] = useState(true);
  const [mcxLiveRate, setMcxLiveRate] = useState<number | null>(null);
  const [goldRates, setGoldRates] = useState<GoldRate[]>([]);
  const [goldTaxSettings, setGoldTaxSettings] = useState<TaxSettings | undefined>();
  const [supremeChanges, setSupremeChanges] = useState<SupremeChanges | undefined>();
  const [bhawSource, setBhawSource] = useState<{ key: string; name: string; live: boolean } | undefined>();
  const [subscriptionOverview, setSubscriptionOverview] = useState<SubscriptionOverview | null>(null);
  const [trialActionLoading, setTrialActionLoading] = useState(false);
  const { employee, userRole: settingsUserRole } = useSettingsAccess();
  const globalMatrixValues = useMatricesStore((s) => s.values);

  // Use employee's granular matrix permissions if logged in as employee, otherwise fallback to global device values
  const matrixValues = settingsUserRole === 'employee' && employee
    ? employee.permissions
    : globalMatrixValues;

  const sortedGoldRates = useMemo(
    () => sortGoldRates(goldRates.filter((rate) => !rate.isHidden)),
    [goldRates],
  );
  const mcxFinalRate = useMemo(() => {
    const live = mcxLiveRate ?? 0;
    const mcxChangeBy =
      goldTaxSettings?.mcxChangeBy ??
      resolveMcxChangeValue(goldTaxSettings?.mcxChange);
    return goldTaxSettings?.mcxFinalRate ?? live + mcxChangeBy;
  }, [goldTaxSettings?.mcxChange, goldTaxSettings?.mcxChangeBy, goldTaxSettings?.mcxFinalRate, mcxLiveRate]);
  const rtgsFinalRate = useMemo(() => {
    if (mcxLiveRate == null) return goldTaxSettings?.rtgsFinalRate ?? 0;
    const supremeRtgsBase =
      supremeChanges?.supremeRtgs ??
      mcxLiveRate + (supremeChanges?.rtgsChange ?? 0);
    const supremeRtgsChange = supremeRtgsBase - mcxLiveRate;
    const rtgsCurrentRate = (mcxFinalRate ?? 0) + supremeRtgsChange;
    return rtgsCurrentRate + (goldTaxSettings?.rtgsChangeBy ?? 0);
  }, [goldTaxSettings?.rtgsChangeBy, goldTaxSettings?.rtgsFinalRate, mcxFinalRate, mcxLiveRate, supremeChanges]);
  const cashFinalRate = useMemo(() => {
    if (mcxLiveRate == null) return goldTaxSettings?.cashFinalRate ?? 0;
    const supremeCashBase =
      supremeChanges?.supremeCash ??
      mcxLiveRate + (supremeChanges?.cashChange ?? 0);
    const supremeCashChange = supremeCashBase - mcxLiveRate;
    const cashCurrentRate = (mcxFinalRate ?? 0) + supremeCashChange;
    return cashCurrentRate + (goldTaxSettings?.cashChangeBy ?? 0);
  }, [goldTaxSettings?.cashChangeBy, goldTaxSettings?.cashFinalRate, mcxFinalRate, mcxLiveRate, supremeChanges]);
  const twentyFourKRate = useMemo(() => {
    const matched = sortedGoldRates.find((rate) => {
      const carat = rate.carat.toLowerCase();
      return carat.includes('24') || Math.abs(rate.purity - 99.9) < 0.2;
    });

    if (matched) return matched;
    if (mcxLiveRate == null && !goldTaxSettings) return null;

    const cashRate = cashFinalRate || mcxFinalRate || 0;
    const rtgsRate = rtgsFinalRate || mcxFinalRate || 0;

    return {
      id: '24k-synthetic',
      carat: '24Kt',
      purity: 99.9,
      finalRate: rtgsRate,
      cashRate,
      rtgsRate,
      baseRate: mcxFinalRate ?? rtgsRate,
      mcxRate: mcxLiveRate ?? undefined,
    } satisfies GoldRate;
  }, [cashFinalRate, goldTaxSettings, mcxFinalRate, mcxLiveRate, rtgsFinalRate, sortedGoldRates]);
  const show24kMcx = matrixValues['24k_mcx' as MatrixKey] !== false;
  const show24kRtgs = matrixValues['24k_rtgs' as MatrixKey] !== false;
  const show24kCash = matrixValues['24k_cash' as MatrixKey] !== false;
  const show24kRateCard = show24kRtgs || show24kCash;

  const loadMarketData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [gold, subscription] = await Promise.all([
        fetchGoldRates(),
        authUserRole === 'business' ? fetchSubscriptionOverview() : Promise.resolve(null),
      ]);
      setMcxLiveRate(gold.mcxLiveRate);
      setGoldRates(gold.rates);
      setGoldTaxSettings(gold.taxSettings);
      setSupremeChanges(gold.supremeChanges);
      setBhawSource(gold.bhawSource);
      setSubscriptionOverview(subscription);
    } catch (error) {
      if (authUserRole === 'business') {
        setSubscriptionOverview(null);
      }
      if (showLoader) {
        const message =
          error instanceof ApiError
            ? error.message
            : 'Failed to load market rates. Showing last known values.';
        Alert.alert('Market Data', message);
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [authUserRole]);

  useEffect(() => {
    if (authUserRole !== 'business') return;
    if (!subscriptionOverview) return;
    if (subscriptionOverview.status !== 'FREE_TRIAL_LICENSE') return;
    if (!subscriptionOverview.trialEndDate) return;

    const endMs = new Date(subscriptionOverview.trialEndDate).getTime();
    if (!Number.isFinite(endMs)) return;

    const delay = endMs - Date.now();
    if (delay <= 0) {
      void loadMarketData(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      void loadMarketData(false);
    }, delay + 500);

    return () => clearTimeout(timeoutId);
  }, [authUserRole, loadMarketData, subscriptionOverview]);

  useFocusEffect(
    useCallback(() => {
      void loadMarketData();
    }, [loadMarketData]),
  );

  useEffect(() => {
    // Auto-refresh the dashboard every 60 seconds
    const intervalId = setInterval(() => {
      // Pass false to loadMarketData to avoid showing the loading spinner every minute
      void loadMarketData(false);
    }, 60000);
    return () => clearInterval(intervalId);
  }, [loadMarketData]);

  const handleStartTrial = useCallback(async () => {
    try {
      setTrialActionLoading(true);
      await startFreeTrial();
      await loadMarketData(false);
      Alert.alert(
        'Free Trial Started',
        '100 free scanning credits have been granted.\n\nYour free trial is valid for 10 days.',
        [{ text: 'Continue' }],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start free trial.';
      Alert.alert('Subscription', message);
    } finally {
      setTrialActionLoading(false);
    }
  }, [loadMarketData]);

  const handlePurchaseLicense = useCallback(() => {
    router.push('/dashboard/purchase-license');
  }, [router]);

  const showTopBanner = subscriptionOverview
    && (
      subscriptionOverview.status === 'NO_LICENSE'
      || subscriptionOverview.status === 'FREE_TRIAL_LICENSE'
      || subscriptionOverview.status === 'FREE_TRIAL'
      || subscriptionOverview.status === 'EXPIRED'
    );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <DashboardHeader />

        <View style={styles.cardsWrap}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.brandDeep} />
              <Text style={styles.loadingText}>Loading live MCX rates...</Text>
            </View>
          ) : (
            <>
              <View style={styles.topRow}>
                {showTopBanner ? (
                  <SubscriptionBanner
                    licenseStatus={subscriptionOverview!.status}
                    trialDaysRemaining={subscriptionOverview!.trialDaysRemaining || 0}
                    trialHoursRemaining={subscriptionOverview!.trialHoursRemaining || 0}
                    trialEndDate={subscriptionOverview!.trialEndDate || null}
                    onStartTrial={handleStartTrial}
                    onPurchase={handlePurchaseLicense}
                    trialExpiredAt={subscriptionOverview!.trialExpiredAt || null}
                    loading={trialActionLoading}
                  />
                ) : (
                  <View style={styles.topRowSpacer} />
                )}
                <TimeTile />
              </View>

              {mcxLiveRate != null && show24kMcx ? (
                <GradientView
                  colors={Gradients.metallic}
                  borderRadius={14}
                  sheen={0.55}
                  topHighlight={0.6}
                  style={styles.mcxTopCard}
                >
                  <Text style={styles.mcxTopLabel}>MCX Gold Rate (24 Kt)</Text>
                  <Text style={styles.mcxTopValue}>₹ {(mcxFinalRate ?? mcxLiveRate).toLocaleString('en-IN')}</Text>
                </GradientView>
              ) : null}

              {twentyFourKRate && show24kRateCard ? (
                <View style={styles.rateCard}>
                  <View style={styles.rateCardHeader}>
                    <Text style={styles.cardKaratLabel}>Gold (24K) 99.9%</Text>
                  </View>

                  <View style={styles.rateCardBody}>
                    {show24kCash ? (
                      <RateBadge
                        value={`₹ ${(twentyFourKRate.cashRate ?? cashFinalRate ?? twentyFourKRate.finalRate).toLocaleString('en-IN')}`}
                        label="Cash Rate"
                      />
                    ) : null}
                    {show24kRtgs ? (
                      <RateBadge
                        value={`₹ ${(twentyFourKRate.rtgsRate ?? rtgsFinalRate ?? twentyFourKRate.finalRate).toLocaleString('en-IN')}`}
                        label="RTGS Rate"
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}

              {bhawSource ? (
                <GradientView
                  colors={Gradients.metallic}
                  borderRadius={14}
                  sheen={0.55}
                  topHighlight={0.6}
                  style={styles.bhawCard}
                >
                  <View style={styles.bhawLeft}>
                    <Text style={styles.mcxTopLabel}>Bhaw</Text>
                    <Text style={styles.bhawSourceName}>{bhawSource.name}</Text>
                  </View>
                  <View style={styles.bhawValues}>
                    <View style={styles.bhawItem}>
                      <Text style={styles.bhawItemLabel}>Cash</Text>
                      <Text style={styles.bhawItemValue}>
                        {formatBhawChange(supremeChanges?.cashChange)}
                      </Text>
                    </View>
                    <View style={styles.bhawItem}>
                      <Text style={styles.bhawItemLabel}>RTGS</Text>
                      <Text style={styles.bhawItemValue}>
                        {formatBhawChange(supremeChanges?.rtgsChange)}
                      </Text>
                    </View>
                  </View>
                </GradientView>
              ) : null}

              {sortedGoldRates.length > 0 ? (
                sortedGoldRates
                  .filter((rate) => {
                    const carat = rate.carat.toLowerCase();
                    return !(carat.includes('24') || Math.abs(rate.purity - 99.9) < 0.2);
                  })
                  .map((rate) => {
                  const karatPrefix = rate.carat.replace('Kt', 'k').toLowerCase();
                  const showCash = matrixValues[`${karatPrefix}_cash` as MatrixKey];
                  const showRtgs = matrixValues[`${karatPrefix}_rtgs` as MatrixKey];

                  if (!showCash && !showRtgs) return null;

                  const purityLabel = formatPurityLabel(rate.purity);

                  return (
                    <View key={rate.carat} style={styles.rateCard}>
                      <View style={styles.rateCardHeader}>
                        <Text style={styles.cardKaratLabel}>
                          Gold ({formatKaratLabel(rate.carat)}) {purityLabel}
                        </Text>
                      </View>

                      <View style={styles.rateCardBody}>
                        {showCash ? (
                          <RateBadge
                            value={`₹ ${(rate.cashRate ?? rate.finalRate)?.toLocaleString('en-IN') || 0}`}
                            label="Cash Rate"
                          />
                        ) : null}
                        {showRtgs ? (
                          <RateBadge
                            value={`₹ ${(rate.rtgsRate ?? rate.finalRate)?.toLocaleString('en-IN') || 0}`}
                            label="RTGS Rate"
                          />
                        ) : null}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No gold rates available</Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

/** Signed bhaw premium/discount, or an em-dash when the feed has no value. */
function formatBhawChange(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value);
  return `${rounded < 0 ? '−' : '+'}${Math.abs(rounded).toLocaleString('en-IN')}`;
}

function formatPurityLabel(purity: number): string {
  if (!Number.isFinite(purity)) return '';
  return `${purity.toFixed(1)}%`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.screenBottom,
  },
  cardsWrap: {
    paddingHorizontal: Spacing.screenHorizontal,
    // Header paddingBottom (4) + 14 = mockup .dash-header margin-bottom 18.
    marginTop: 14,
    gap: Spacing.md,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  emptyWrap: {
    alignItems: 'center',
    marginTop: 32,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  topRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 2,
  },
  topRowSpacer: {
    flex: 1,
  },
  timeTile: {
    minWidth: 84,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#786441',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 4,
  },
  timeDay: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
    opacity: 0.7,
    letterSpacing: 0.4,
  },
  timeDate: {
    fontSize: 12.8,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  timeClock: {
    fontSize: 10.4,
    fontWeight: '600',
    color: Colors.textPrimary,
    opacity: 0.75,
  },
  mcxTopCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#786441',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 4,
  },
  mcxTopLabel: {
    fontSize: 13.6,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  mcxTopValue: {
    fontSize: 18.4,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  bhawCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
  },
  bhawLeft: {
    gap: 3,
  },
  bhawSourceName: {
    fontSize: 11.2,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  bhawValues: {
    flexDirection: 'row',
    gap: 16,
  },
  bhawItem: {
    alignItems: 'flex-end',
    gap: 1,
  },
  bhawItemLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  bhawItemValue: {
    fontSize: 15.2,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  rateCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rateCardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardKaratLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rateCardBody: {
    flexDirection: 'row',
    gap: 10,
  },
  rateBadge: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateBadgeValue: {
    fontSize: 13.8,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rateBadgeLabel: {
    fontSize: 10.6,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
