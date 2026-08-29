import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { GoldRateSettingsPanel } from '@/components/dashboard/market-rates/GoldRateSettings';
import { ToastNotification, type ToastType } from '@/components/scanner/ToastNotification';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRequireMarketRatesAccess } from '@/hooks/useMarketRatesAccess';
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
