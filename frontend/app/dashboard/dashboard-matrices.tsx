import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { AddBullionRow } from '@/components/settings/AddBullionRow';
import { BullionHouseCard } from '@/components/settings/BullionHouseCard';
import { MessagePopup } from '@/components/settings/MessagePopup';
import { DropdownOption, SettingsDropdown } from '@/components/settings/SettingsDropdown';
import {
  GOLD_MATRIX_SECTIONS,
  OPENING_MATRIX_KEYS,
  type MatrixKey,
} from '@/constants/dashboardMatrices';
import { Colors, Spacing } from '@/constants/theme';
import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';
import { useBhawStore } from '@/store/bhawStore';
import { useMatricesStore } from '@/store/matricesStore';
import {
  fetchBullionSources,
  updateBullionSources,
  type BullionSources,
} from '@/utils/bullionApi';
import { updateDashboardMatrices } from '@/utils/matricesApi';

type DashboardMatrixValues = Record<MatrixKey, boolean>;

interface RateOption {
  key: MatrixKey;
  /** The whole name, in the menu and in the closed box: "24K MCX". */
  label: string;
}

/**
 * Every rate the Home dashboard can show, in the order it appears there:
 * 24K MCX / RTGS / Cash first, then 22K and the lighter karats.
 */
const RATE_OPTIONS: RateOption[] = GOLD_MATRIX_SECTIONS.flatMap((section) =>
  section.rows.map((row) => ({
    key: row.key,
    label: `${section.sectionLabel.replace(' GOLD', '')} ${row.label.trim().replace(' Rate', '')}`,
  })),
);

const DEFAULT_DASHBOARD_MATRIX_VALUES: DashboardMatrixValues = {
  '24k_mcx': true,
  '24k_rtgs': true,
  '24k_cash': true,
  '22k_rtgs': false,
  '22k_cash': false,
  '20k_rtgs': false,
  '20k_cash': false,
  '18k_rtgs': false,
  '18k_cash': false,
  '14k_rtgs': false,
  '14k_cash': false,
  '9k_rtgs': false,
  '9k_cash': false,
  'bhaw_source_jmd': false,
};

function normalizeMatrixValues(values: Record<string, boolean> | null | undefined): DashboardMatrixValues {
  // Nothing saved yet means every rate is on, 24K included.
  const merged: DashboardMatrixValues = {
    ...DEFAULT_DASHBOARD_MATRIX_VALUES,
    ...(values ?? {}),
  };
  // Nothing selected at all is a blank dashboard, which nobody chooses: the
  // 24K rates come back. Unticking one of them while others stay on is kept.
  const anyRateOn = RATE_OPTIONS.some((option) => merged[option.key]);
  if (!anyRateOn) {
    for (const key of OPENING_MATRIX_KEYS) merged[key] = true;
  }
  return merged;
}

export default function DashboardMatricesScreen() {
  const allowed = useRequireSettingsAccess('matrices');
  const router = useRouter();
  const storedValues = useMatricesStore((s) => s.values);
  const [draft, setDraft] = useState<DashboardMatrixValues>(() => normalizeMatrixValues(storedValues));
  // One menu at a time, so a long karat list never hides the field above it.
  const [openMenu, setOpenMenu] = useState<'bullion' | 'karat' | null>(null);
  // The houses to choose from: the two on the live feed, plus the shop's own.
  const [bullion, setBullion] = useState<BullionSources | null>(null);
  // The live boards behind the cards. Polling is shared with Home, so opening
  // this screen costs one request rather than a second feed.
  const vendors = useBhawStore((state) => state.vendors);
  const bhawProvider = useBhawStore((state) => state.provider);
  const startBhawPolling = useBhawStore((state) => state.startPolling);
  useEffect(() => startBhawPolling(), [startBhawPolling]);
  useEffect(() => {
    void useBhawStore.getState().hydrateProvider();
  }, []);
  // What the tick sits on: the locally followed house first (it answers
  // instantly and survives cold starts), the server's record behind it.
  const selectedSource = bhawProvider || bullion?.selected || '';
  // What the popup is saying. It closes itself, so nothing here waits on a tap.
  const [popup, setPopup] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setDraft(normalizeMatrixValues(storedValues));
  }, [storedValues]);

  useEffect(() => {
    let cancelled = false;
    void fetchBullionSources().then((loaded) => {
      if (!cancelled && loaded) setBullion(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!allowed) return null;

  const persistToggle = async (
    key: MatrixKey,
    nextValue: boolean,
    previousValue: boolean,
  ) => {
    const nextDraft = { ...draft, [key]: nextValue };

    try {
      const updated = await updateDashboardMatrices(nextDraft as Record<string, boolean>);
      // Merge over the local draft: a backend that predates a setting drops the
      // unknown key from its response, which would otherwise revert the choice.
      const normalized = normalizeMatrixValues({ ...nextDraft, ...(updated ?? {}) });
      setDraft(normalized);
      useMatricesStore.setState((state) => ({
        values: {
          ...state.values,
          ...normalized,
        },
      }));
    } catch (error) {
      setDraft((current) => ({ ...current, [key]: previousValue }));
      setPopup({ text: 'That change could not be saved. Please try again.', tone: 'error' });
      console.error('Failed to update dashboard matrices', error);
    }
  };

  const toggleRate = (key: MatrixKey) => {
    const previousValue = draft[key];
    const nextValue = !previousValue;
    setDraft((current) => ({ ...current, [key]: nextValue }));
    void persistToggle(key, nextValue, previousValue);
  };

  const selectBullion = (key: string) => {
    setOpenMenu(null);
    if (selectedSource === key) return;

    // The phone follows the house at once — Home's rates and the tick are
    // driven from here — and the server records it behind. A server that does
    // not know a newer house yet clamps its own record without pulling the
    // phone off the house the shop chose.
    useBhawStore.getState().setProvider(key);
    useMatricesStore.setState((state) => ({
      values: { ...state.values, bhaw_source_jmd: key === 'jmd_patil' },
    }));

    if (!bullion) return;
    const previous = bullion;
    setBullion({ ...bullion, selected: key });
    void updateBullionSources({ selected: key, requestedNames: bullion.requestedNames })
      .then((saved) => {
        setBullion(saved);
      })
      .catch(() => {
        setBullion(previous);
      });
  };

  /**
   * Records a house the shop wants. It is not added to the list and the
   * followed house does not change: a house with no rates cannot price gold.
   * Returns an error to show, or null.
   */
  const addBullion = async (name: string): Promise<string | null> => {
    if (!bullion) return 'The bullion houses are still loading.';
    const known = [...bullion.houses.map((house) => house.label), ...bullion.requestedNames];
    if (known.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      return 'That bullion house is already on your list.';
    }

    try {
      const saved = await updateBullionSources({
        selected: bullion.selected,
        requestedNames: [...bullion.requestedNames, name],
      });
      setBullion(saved);
      setOpenMenu(null);
      const following =
        saved.houses.find((house) => house.key === saved.selected)?.label ?? 'your current house';
      setPopup({
        text: `${name} has been saved. We'll let you know as soon as its live rates are available in the app.

Home keeps following ${following} until then.`,
        tone: 'success',
      });
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'The bullion house could not be saved.';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* The header stays put; only the settings scroll beneath it. */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.headerTitle}>Dashboard Settings</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>
          Choose which gold rates appear on your Home dashboard.
        </Text>

        {/* Each house as its own board, so the choice is made on the rates
            themselves rather than on a name in a list. */}
        {vendors.length > 0 ? (
          <>
            {vendors.map((vendor) => (
              <BullionHouseCard
                key={String(vendor.source)}
                name={vendor.name}
                vendor={vendor}
                selected={selectedSource === vendor.source}
                onSelect={() => selectBullion(String(vendor.source))}
              />
            ))}
            <AddBullionRow onAdd={addBullion} />
          </>
        ) : (
          <Text style={styles.loadingText}>Loading the bullion houses…</Text>
        )}

        <SettingsDropdown
          title="Choose Karat"
          open={openMenu === 'karat'}
          onPress={() => setOpenMenu((current) => (current === 'karat' ? null : 'karat'))}
        >
          {RATE_OPTIONS.map((option, index) => (
            <DropdownOption
              key={option.key}
              label={option.label}
              selected={draft[option.key]}
              onPress={() => toggleRate(option.key)}
              mode="multi"
              showDivider={index < RATE_OPTIONS.length - 1}
            />
          ))}
        </SettingsDropdown>
      </ScrollView>

      <BottomNav />

      {/* Says what happened and closes itself — there is nothing to acknowledge. */}
      <MessagePopup
        message={popup?.text ?? null}
        tone={popup?.tone}
        onDismiss={() => setPopup(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Outside the scroll view now, so it carries the screen padding itself.
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
