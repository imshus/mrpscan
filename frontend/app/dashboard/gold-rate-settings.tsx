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
import { useGoldRateFigures } from '@/hooks/useGoldRateFigures';
import { useRequireMarketRatesAccess } from '@/hooks/useMarketRatesAccess';
import { useGetGoldRatesQuery, useUpdateGoldTaxSettingsMutation } from '@/store/goldRatesApi';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

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

  // The same base Home reads: the market MCX, the house line, the bhaw.
  // Before the access check, so the hooks run on every render.
  const { base, changes, houseName } = useGoldRateFigures(goldData);

  if (!access.hasAnyAccess) return null;


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
    nextRtgsTaxPercent: number,
    nextRtgsVariant: 'taxed' | 'plain',
  ): Promise<boolean> => {
    try {
      await updateGoldTaxSettingsMutation({
        mcxChange: {
          operation: nextMcxChange < 0 ? '-' : '+',
          amount: Math.abs(nextMcxChange),
        },
        rtgsChangeBy: nextRtgsChange,
        cashChangeBy: nextCashChange,
        rtgsTaxPercent: nextRtgsTaxPercent,
        rtgsVariant: nextRtgsVariant,
      }).unwrap();
      showToast('Gold rate settings updated', 'success');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save gold rate settings';
      showToast(message, 'error');
      return false;
    }
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />

      {/* The header stays put; only the content scrolls beneath it. */}
      <PageHeader title="Gold Rate Settings" />
      <KeyboardAwareScrollView contentContainerStyle={screenStyles.scrollContent} showsVerticalScrollIndicator={false}>

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
                mcxLiveRate={base?.mcx ?? null}
                pricingMcxRate={base?.pricingMcx}
                cashLive={base?.cashLive ?? false}
                rtgsLive={base?.rtgsLive ?? false}
                mcxChange={changes?.mcxChange ?? 0}
                supremeRtgsChange={base?.rtgsBhaw ?? 0}
                supremeCashChange={base?.cashBhaw ?? 0}
                rtgsChange={changes?.rtgsChange ?? 0}
                rtgsTaxPercent={changes?.rtgsTaxPercent ?? 0}
                rtgsVariant={changes?.rtgsVariant ?? 'taxed'}
                cashChange={changes?.cashChange ?? 0}
                bhawSourceName={houseName}
                bhawRtgs={base?.rtgsBhaw}
                bhawCash={base?.cashBhaw}
                onApply={handleApplyTaxSettings}
                showTitle={false}
                showClose={false}
              />

              {isSaving ? <View style={styles.savingOverlay} /> : null}
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>

      <ToastNotification
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      <BottomNav />
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
