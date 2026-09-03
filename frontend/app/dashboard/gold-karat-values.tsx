import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { ChevronDown, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import {
  GoldEditModalFields,
  GoldRatesTable,
} from '@/components/dashboard/market-rates/GoldRatesTable';
import { ToastNotification, type ToastType } from '@/components/scanner/ToastNotification';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRequireMarketRatesAccess } from '@/hooks/useMarketRatesAccess';
import {
  useGetGoldRatesQuery,
  useUpdateGoldRateMutation,
  useUpdateGoldRateVisibilityMutation,
} from '@/store/goldRatesApi';
import type { GoldRate } from '@/types/rates';
import { formatKaratLabel, validatePurityValue } from '@/utils/goldRateUtils';

const BUTTON_GREEN = '#A81F17';
const CARAT_ORDER = ['22Kt', '20Kt', '18Kt', '14Kt', '9Kt'];

const TABLE_ROW_ANIMATION = {
  duration: 220,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

const SECTION_ANIMATION = {
  duration: 220,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

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

export default function GoldKaratValuesScreen() {
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

  const [updateGoldRateMutation, { isLoading: isUpdatingGoldRate }] = useUpdateGoldRateMutation();
  const [updateGoldRateVisibilityMutation] = useUpdateGoldRateVisibilityMutation();

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const [editingGold, setEditingGold] = useState<GoldRate | null>(null);
  const [editPurity, setEditPurity] = useState('');
  const [editPurityError, setEditPurityError] = useState<string | null>(null);

  const [hiddenGoldRateIds, setHiddenGoldRateIds] = useState<string[]>([]);
  const [hiddenOverrides, setHiddenOverrides] = useState<Record<string, boolean | undefined>>({});
  const [hiddenSectionOpen, setHiddenSectionOpen] = useState(false);

  const goldRates = goldData?.rates ?? [];
  const sortedGoldRates = useMemo(() => sortGoldRates(goldRates), [goldRates]);

  const goldRateKey = (rate: GoldRate) => rate.id ?? rate.carat;

  const visibleGoldRates = useMemo(
    () =>
      sortedGoldRates.filter((rate) => {
        const key = goldRateKey(rate);
        const override = hiddenOverrides[key];
        const isHidden = override ?? rate.isHidden ?? false;
        return !isHidden && !hiddenGoldRateIds.includes(key);
      }),
    [sortedGoldRates, hiddenGoldRateIds, hiddenOverrides],
  );

  const hiddenGoldRates = useMemo(
    () =>
      sortedGoldRates.filter((rate) => {
        const key = goldRateKey(rate);
        const override = hiddenOverrides[key];
        const isHidden = override ?? rate.isHidden ?? false;
        return isHidden || hiddenGoldRateIds.includes(key);
      }),
    [sortedGoldRates, hiddenGoldRateIds, hiddenOverrides],
  );

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    const knownKeys = new Set(sortedGoldRates.map((rate) => goldRateKey(rate)));
    const serverHidden = new Set(
      sortedGoldRates.filter((rate) => rate.isHidden).map((rate) => goldRateKey(rate)),
    );
    const next = Array.from(serverHidden).filter((key) => knownKeys.has(key));
    setHiddenGoldRateIds((prev) =>
      next.length === prev.length && next.every((key, idx) => key === prev[idx]) ? prev : next,
    );
  }, [sortedGoldRates]);

  useEffect(() => {
    if (hiddenGoldRates.length === 0 && hiddenSectionOpen) {
      setHiddenSectionOpen(false);
    }
  }, [hiddenGoldRates.length, hiddenSectionOpen]);

  if (!access.hasAnyAccess) return null;

  const isSaving = isUpdatingGoldRate;
  const showGoldLoading = isGoldLoading && !goldData;
  const hasGoldError = !!goldError && !goldData;

  const openGoldEdit = (rate: GoldRate) => {
    setEditingGold(rate);
    setEditPurity(String(rate.purity));
    setEditPurityError(null);
  };

  const handleHideGoldRate = async (rate: GoldRate) => {
    LayoutAnimation.configureNext(TABLE_ROW_ANIMATION);
    const key = goldRateKey(rate);
    setHiddenOverrides((prev) => ({ ...prev, [key]: true }));
    setHiddenGoldRateIds((prev) => (prev.includes(key) ? prev : [...prev, key]));

    try {
      await updateGoldRateVisibilityMutation({
        id: rate.id,
        carat: rate.carat,
        hidden: true,
      }).unwrap();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to hide gold rate';
      showToast(message, 'error');
      setHiddenOverrides((prev) => ({ ...prev, [key]: undefined }));
      setHiddenGoldRateIds((prev) => prev.filter((id) => id !== key));
      return;
    }

    setHiddenOverrides((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleRestoreGoldRate = async (rate: GoldRate) => {
    LayoutAnimation.configureNext(TABLE_ROW_ANIMATION);
    const key = goldRateKey(rate);
    setHiddenOverrides((prev) => ({ ...prev, [key]: false }));
    setHiddenGoldRateIds((prev) => prev.filter((id) => id !== key));

    try {
      await updateGoldRateVisibilityMutation({
        id: rate.id,
        carat: rate.carat,
        hidden: false,
      }).unwrap();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore gold rate';
      showToast(message, 'error');
      setHiddenOverrides((prev) => ({ ...prev, [key]: undefined }));
      setHiddenGoldRateIds((prev) => (prev.includes(key) ? prev : [...prev, key]));
      return;
    }

    setHiddenOverrides((prev) => ({ ...prev, [key]: undefined }));
  };

  const toggleHiddenSection = () => {
    LayoutAnimation.configureNext(SECTION_ANIMATION);
    setHiddenSectionOpen((prev) => !prev);
  };

  const handleEditPurityChange = (value: string) => {
    setEditPurity(value);
    const purity = Number(value);
    const purityErr = validatePurityValue(purity);
    setEditPurityError(purityErr);
  };

  const handleSaveGoldEdit = async () => {
    if (!editingGold) return;
    const purity = Number(editPurity);
    const purityErr = validatePurityValue(purity);
    setEditPurityError(purityErr);
    if (purityErr) return;

    try {
      const updated = await updateGoldRateMutation({
        carat: editingGold.carat,
        purity,
      }).unwrap();
      setEditingGold(null);
      showToast(`${formatKaratLabel(updated.carat)} rate updated`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update gold rate. Please try again.';
      showToast(message, 'error');
    }
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />

      {/* The header stays put; only the content scrolls beneath it. */}
      <PageHeader title="Gold Karat Values" />
      <ScrollView contentContainerStyle={screenStyles.scrollContent} showsVerticalScrollIndicator={false}>

        {showGoldLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={BUTTON_GREEN} />
            <Text style={styles.loadingText}>Loading rates…</Text>
          </View>
        ) : access.canEditGold ? (
          <View style={screenStyles.screenSection}>
            {visibleGoldRates.length > 0 ? (
              <GoldRatesTable
                rates={visibleGoldRates}
                onEdit={openGoldEdit}
                onToggleVisibility={handleHideGoldRate}
                visibilityAction="hide"
              />
            ) : hiddenGoldRates.length > 0 ? (
              <View style={screenStyles.emptyCard}>
                <Text style={screenStyles.emptyText}>All gold rates are hidden.</Text>
              </View>
            ) : hasGoldError ? (
              <View style={screenStyles.emptyCard}>
                <Text style={screenStyles.emptyText}>Unable to load gold rates. Pull down to refresh.</Text>
              </View>
            ) : (
              <View style={screenStyles.emptyCard}>
                <Text style={screenStyles.emptyText}>No gold rates available.</Text>
              </View>
            )}

            {hiddenGoldRates.length > 0 ? (
              <View style={styles.hiddenSection}>
                <Pressable onPress={toggleHiddenSection} style={styles.hiddenHeader}>
                  <Text style={styles.hiddenTitle}>Hidden Gold Karat Values ({hiddenGoldRates.length})</Text>
                  <ChevronDown
                    size={18}
                    color={Colors.textMuted}
                    style={hiddenSectionOpen ? styles.hiddenChevronOpen : undefined}
                  />
                </Pressable>
                {hiddenSectionOpen ? (
                  <View style={styles.hiddenTableWrap}>
                    <GoldRatesTable
                      rates={hiddenGoldRates}
                      onEdit={openGoldEdit}
                      onToggleVisibility={handleRestoreGoldRate}
                      visibilityAction="restore"
                      showEditAction={false}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={screenStyles.emptyCard}>
            <Text style={screenStyles.emptyText}>You do not have permission to view or edit Gold Rates.</Text>
          </View>
        )}
      </ScrollView>

      <ToastNotification
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      <BottomNav activeRoute="home" />

      <Modal visible={editingGold !== null} transparent animationType="fade" onRequestClose={() => setEditingGold(null)}>
        <View style={screenStyles.modalOverlay}>
          <View style={screenStyles.modalCard}>
            <Pressable onPress={() => setEditingGold(null)} hitSlop={8} style={styles.modalClose}>
              <X size={20} color={Colors.textSecondary} />
            </Pressable>
            <Text style={styles.modalTitle}>Edit {editingGold ? formatKaratLabel(editingGold.carat) : ''} Purity</Text>
            <GoldEditModalFields
              karatLabel={editingGold ? formatKaratLabel(editingGold.carat) : ''}
              purity={editPurity}
              purityError={editPurityError}
              onPurityChange={handleEditPurityChange}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditingGold(null)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleSaveGoldEdit}
                disabled={isSaving}
                style={[styles.applyBtn, isSaving && styles.applyBtnDisabled]}
              >
                {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.applyBtnText}>Apply</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { paddingVertical: 48, alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 14, color: Colors.textMuted },
  hiddenSection: {
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  hiddenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: '#FBF7F0',
  },
  hiddenTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  hiddenChevronOpen: { transform: [{ rotate: '180deg' }] },
  hiddenTableWrap: { padding: Spacing.md },
  modalClose: { alignSelf: 'flex-end' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  cancelBtn: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  applyBtn: {
    flex: 1,
    height: Spacing.buttonHeight,
    backgroundColor: BUTTON_GREEN,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  applyBtnDisabled: { opacity: 0.7 },
});
