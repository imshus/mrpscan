import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { GoldRateSettingsPanel } from '@/components/dashboard/market-rates/GoldRateSettings';
import { ToastNotification, type ToastType } from '@/components/scanner/ToastNotification';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useBhawRates } from '@/hooks/useBhawRates';
import { useRequireMarketRatesAccess } from '@/hooks/useMarketRatesAccess';
import { useMatricesStore } from '@/store/matricesStore';
import { BHAW_PROVIDERS, formatBhaw as formatBhawValue } from '@/utils/bhawApi';
import { useGetGoldRatesQuery, useUpdateGoldTaxSettingsMutation } from '@/store/goldRatesApi';
import { resolveMcxChangeValue } from '@/utils/goldRateUtils';

export default function GoldRateSettingsScreen() {
  const access = useRequireMarketRatesAccess();

  const {
    data: goldData,
    isLoading: isGoldLoading,
    error: goldError,
  } = useGetGoldRatesQuery(undefined, {
    skip: !access.hasAnyAccess,
    pollingInterval: 30000,
    refetchOnMountOrArgChange: true,
    refetchOnReconnect: true,
    refetchOnFocus: true,
  });

  const [updateGoldTaxSettingsMutation, { isLoading: isUpdatingTaxSettings }] =
    useUpdateGoldTaxSettingsMutation();

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  if (!access.hasAnyAccess) return null;

  const mcxLiveRate = goldData?.mcxLiveRate ?? 0;
  const mcxChangeBy =
    goldData?.taxSettings?.mcxChangeBy ??
    resolveMcxChangeValue(goldData?.taxSettings?.mcxChange);
  const supremeRtgsBase =
    goldData?.supremeChanges?.supremeRtgs ??
    mcxLiveRate + (goldData?.supremeChanges?.rtgsChange ?? 0);
  const supremeCashBase =
    goldData?.supremeChanges?.supremeCash ??
    mcxLiveRate + (goldData?.supremeChanges?.cashChange ?? 0);
  const supremeRtgsChange = supremeRtgsBase - mcxLiveRate;
  const supremeCashChange = supremeCashBase - mcxLiveRate;
  const rtgsChange = goldData?.taxSettings?.rtgsChangeBy ?? 0;
  const cashChange = goldData?.taxSettings?.cashChangeBy ?? 0;

  const mcxFinalRate = goldData?.taxSettings?.mcxFinalRate ?? mcxLiveRate + mcxChangeBy;

  // Live bhaw for the selected provider, applied to the MCX rate.
  const bhaw = useBhawRates({
    mcxBaseRate: mcxFinalRate,
    businessCashChange: cashChange,
    businessRtgsChange: rtgsChange,
    fallbackCashBhaw: supremeCashChange,
    fallbackRtgsBhaw: supremeRtgsChange,
  });

  const useJmd = useMatricesStore((state) => state.values.bhaw_source_jmd);
  const applyMatrixValues = useMatricesStore((state) => state.applyValues);
  const matrixValues = useMatricesStore((state) => state.values);

  const selectProvider = (provider: string) => {
    const nextUseJmd = provider === BHAW_PROVIDERS.JMD_PATIL;
    if (nextUseJmd === Boolean(useJmd)) return;
    void applyMatrixValues({ ...matrixValues, bhaw_source_jmd: nextUseJmd });
  };

  const isSaving = isUpdatingTaxSettings;
  const showLoading = isGoldLoading && !goldData;
  const hasError = !!goldError && !goldData;

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  const handleApplyTaxSettings = async (
    nextMcxChange: number,
    nextRtgsChange: number,
    nextCashChange: number,
  ) => {
    try {
      await updateGoldTaxSettingsMutation({
        mcxChange: {
          operation: nextMcxChange < 0 ? '-' : '+',
          amount: Math.abs(nextMcxChange),
        },
        rtgsChangeBy: nextRtgsChange,
        cashChangeBy: nextCashChange,
      }).unwrap();
      showToast('Gold rate settings updated', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save gold rate settings';
      showToast(message, 'error');
    }
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <ScrollView contentContainerStyle={screenStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <PageHeader title="Gold Rate Settings" />

        <View style={screenStyles.screenSection}>
          <View style={styles.bhawCard}>
            <View style={styles.bhawHeader}>
              <Text style={styles.bhawTitle}>Bhaw Provider</Text>
              <Text style={styles.bhawTag}>
                {bhaw.isLive ? 'Live' : 'Feed unavailable'}
              </Text>
            </View>
            <Text style={styles.bhawHint}>
              Cash and RTGS rates are the MCX rate plus this provider&apos;s bhaw.
            </Text>

            <View style={styles.providerRow}>
              {[
                { key: BHAW_PROVIDERS.JMD_PATIL, label: 'JMD Patil' },
                { key: BHAW_PROVIDERS.MEGA_BULLION, label: 'Mega Bullion' },
              ].map((option) => {
                const active =
                  (option.key === BHAW_PROVIDERS.JMD_PATIL) === Boolean(useJmd);
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => selectProvider(option.key)}
                    style={active ? styles.providerChipActive : styles.providerChip}
                  >
                    <Text style={active ? styles.providerTextActive : styles.providerText}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.bhawRow}>
              <Text style={styles.bhawLabel}>Cash</Text>
              <Text style={styles.bhawValue}>
                {formatBhawValue(bhaw.cashBhaw)}  ·  ₹ {bhaw.cashRate.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.bhawDivider} />
            <View style={styles.bhawRow}>
              <Text style={styles.bhawLabel}>RTGS</Text>
              <Text style={styles.bhawValue}>
                {formatBhawValue(bhaw.rtgsBhaw)}  ·  ₹ {bhaw.rtgsRate.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {showLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading rates…</Text>
            </View>
          ) : hasError ? (
            <View style={screenStyles.emptyCard}>
              <Text style={screenStyles.emptyText}>Unable to load gold rates. Pull down to refresh.</Text>
            </View>
          ) : (
            <View style={styles.settingsCard}>
              <GoldRateSettingsPanel
                visible
                mcxLiveRate={mcxLiveRate}
                mcxChange={mcxChangeBy}
                supremeRtgsChange={supremeRtgsChange}
                supremeCashChange={supremeCashChange}
                rtgsChange={rtgsChange}
                cashChange={cashChange}
                onApply={handleApplyTaxSettings}
                showTitle={false}
                showClose={false}
              />

              {isSaving ? <View style={styles.savingOverlay} /> : null}
            </View>
          )}
        </View>
      </ScrollView>

      <ToastNotification
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bhawCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: Spacing.md,
  },
  bhawHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bhawTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  bhawTag: {
    fontSize: 10.5,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bhawHint: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 11.5,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  bhawRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  bhawLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  bhawValue: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  providerRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 4 },
  providerChip: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerChipActive: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.brandDeep,
    backgroundColor: Colors.brandDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  providerTextActive: { fontSize: 13, fontWeight: '700', color: Colors.white },
  bhawDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  loadingWrap: { paddingVertical: 48, alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 14, color: Colors.textMuted },
  settingsCard: {
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.card,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
