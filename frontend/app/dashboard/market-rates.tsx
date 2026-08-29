import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoldRateSettingsRow } from '@/components/dashboard/market-rates/GoldRateSettings';
import { LabourRatesPanel } from '@/components/dashboard/market-rates/LabourRatesPanel';
import { DiamondRatesPanel } from '@/components/dashboard/market-rates/DiamondRatesPanel';
import { ColorstoneRatesPanel } from '@/components/dashboard/market-rates/ColorstoneRatesPanel';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { ToastNotification, type ToastType } from '@/components/scanner/ToastNotification';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRequireMarketRatesAccess } from '@/hooks/useMarketRatesAccess';
type RatesTab = 'gold' | 'diamond' | 'colorstone' | 'labour';

const TAB_SCREEN_TITLE: Record<RatesTab, string> = {
  gold: 'Gold Rates',
  diamond: 'Diamond Rates',
  colorstone: 'Colorstone Rates',
  labour: 'Labour Charge Rates',
};

function parseTabParam(tab?: string): RatesTab {
  if (tab === 'diamond' || tab === 'colorstone' || tab === 'labour' || tab === 'gold') {
    return tab;
  }
  return 'gold';
}

export default function MarketRatesScreen() {
  const access = useRequireMarketRatesAccess();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const activeTab = useMemo(() => parseTabParam(tab), [tab]);

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  if (!access.hasAnyAccess) return null;

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <ScrollView contentContainerStyle={screenStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <PageHeader title={TAB_SCREEN_TITLE[activeTab]} />

        {activeTab === 'gold' ? (
          access.canEditGold ? (
            <View style={screenStyles.screenSection}>
              <GoldRateSettingsRow onPress={() => router.push('/dashboard/gold-rate-settings')} />
              <Pressable onPress={() => router.push('/dashboard/gold-karat-values')} style={styles.sectionRow}>
                <View style={styles.sectionRowTextWrap}>
                  <Text style={styles.sectionRowTitle}>Gold Karat Values</Text>
                  <Text style={styles.sectionRowSubtitle}>Manage karat purity and visibility</Text>
                </View>
                <ChevronRight size={18} color={Colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <View style={screenStyles.emptyCard}>
              <Text style={screenStyles.emptyText}>You do not have permission to view or edit Gold Rates.</Text>
            </View>
          )
        ) : activeTab === 'labour' ? (
          access.canEditLabour ? (
            <View style={screenStyles.screenSection}>
              <LabourRatesPanel onToast={showToast} />
            </View>
          ) : (
            <View style={screenStyles.emptyCard}>
              <Text style={screenStyles.emptyText}>You do not have permission to view or edit Labour Charges.</Text>
            </View>
          )
        ) : activeTab === 'diamond' || activeTab === 'colorstone' ? (
          (activeTab === 'diamond' && access.canEditDiamond) ||
          (activeTab === 'colorstone' && access.canEditColorstone) ? (
            <View style={screenStyles.screenSection}>
              {activeTab === 'diamond' ? (
                <DiamondRatesPanel onToast={showToast} />
              ) : (
                <ColorstoneRatesPanel onToast={showToast} />
              )}
            </View>
          ) : (
            <View style={screenStyles.emptyCard}>
              <Text style={screenStyles.emptyText}>
                You do not have permission to view or edit {activeTab === 'diamond' ? 'Diamond' : 'Colorstone'} Rates.
              </Text>
            </View>
          )
        ) : null}
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
  },
  sectionRowTextWrap: { flex: 1, paddingRight: Spacing.sm },
  sectionRowTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  sectionRowSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
