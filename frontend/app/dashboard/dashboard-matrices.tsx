import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { AddBullionRow } from '@/components/settings/AddBullionRow';
import { BullionHouseCard } from '@/components/settings/BullionHouseCard';
import { MessagePopup } from '@/components/settings/MessagePopup';
import { DropdownOption } from '@/components/settings/SettingsDropdown';
import { MasterNavList } from '@/components/dashboard/masters/MasterNavList';
import type { MasterNavItem } from '@/constants/settingsMasters';
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
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

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
  '24k_rtgs': false,
  '24k_cash': false,
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

/**
 * Dashboard Settings is a hub of two pages, at the shop's asking: one to
 * choose the bullion house, one to choose which gold rates Home shows. Both
 * are this screen with a `section`; with none it lists the two.
 */
const DASHBOARD_SETTINGS_PAGES: MasterNavItem[] = [
  {
    id: 'bullion',
    title: 'Choose a Bullion',
    subtitle: '',
    route: '/dashboard/dashboard-matrices?section=bullion',
  },
  {
    id: 'rate-view',
    title: 'Choose Gold Rate View',
    subtitle: '',
    route: '/dashboard/dashboard-matrices?section=rate-view',
  },
];

export default function DashboardMatricesScreen() {
  const allowed = useRequireSettingsAccess('matrices');
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const view: 'hub' | 'bullion' | 'rate-view' =
    section === 'bullion' ? 'bullion' : section === 'rate-view' ? 'rate-view' : 'hub';
  const screenTitle =
    view === 'bullion' ? 'Choose a Bullion' : view === 'rate-view' ? 'Choose Gold Rate View' : 'Dashboard Settings';
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
  // What the popup is saying. It stays until its cross (or a tap) closes it.
  const [popup, setPopup] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Saves of this screen still on their way to the server. While any is,
  // the store does not feed the draft: an earlier tap's answer landing
  // after a later tap used to reset the list for a moment, and that tick
  // blinked off and on.
  const savesInFlight = useRef(0);

  // The store's values feed the draft, but only when they differ: a save
  // writes the toggled key back to the store, and re-setting an equal draft
  // for that re-rendered every row a beat after the tap.
  useEffect(() => {
    if (savesInFlight.current > 0) return;
    const next = normalizeMatrixValues(storedValues);
    setDraft((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
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

  // The draft as of the latest tap, for the save that follows it: two quick
  // taps used to send the second with the first not yet in it, and the
  // server's answer to that undid the first tick.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const persistToggle = async (key: MatrixKey, nextValue: boolean, previousValue: boolean) => {
    const nextDraft = { ...draftRef.current, [key]: nextValue };
    savesInFlight.current += 1;
    try {
      await updateDashboardMatrices(nextDraft as Record<string, boolean>);
      // The tick was drawn on the tap and stays as drawn: applying the
      // server's echo re-rendered the whole list a beat later, which read
      // as the check catching up on itself. Home follows the one key that
      // changed.
      useMatricesStore.setState((state) => ({
        values: { ...state.values, [key]: nextValue },
      }));
    } catch (error) {
      setDraft((current) => ({ ...current, [key]: previousValue }));
      setPopup({ text: 'That change could not be saved. Please try again.', tone: 'error' });
      console.error('Failed to update dashboard matrices', error);
    } finally {
      savesInFlight.current -= 1;
    }
  };

  const toggleRate = useCallback((key: MatrixKey) => {
    const previousValue = Boolean(draftRef.current[key]);
    const nextValue = !previousValue;
    if (!nextValue) {
      const othersOn = RATE_OPTIONS.some(
        (option) => option.key !== key && Boolean(draftRef.current[option.key]),
      );
      // Home always shows at least one rate; the last one stays ticked.
      if (!othersOn) return;
    }
    setDraft((current) => ({ ...current, [key]: nextValue }));
    void persistToggle(key, nextValue, previousValue);
    // persistToggle reaches the latest draft through the ref and nothing
    // else that changes, so the handler is made once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One handler per row, made once: a memoised row re-renders only when its
  // own props change, and a fresh arrow on every render was a changed prop.
  const toggleHandlers = useMemo(
    () =>
      Object.fromEntries(
        RATE_OPTIONS.map((option) => [option.key, () => toggleRate(option.key)]),
      ) as Record<MatrixKey, () => void>,
    [toggleRate],
  );

  if (!allowed) return null;

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
        <Text style={styles.headerTitle}>{screenTitle}</Text>
      </View>
      {/* The keyboard-aware list alone lifts the name being typed above the
          keyboard. It used to sit inside a KeyboardAvoidingView as well,
          which shrank the list for the keyboard a second time: scrolled to
          its end, the list then showed the Add Bullion field up under the
          header with an empty page below it. */}
      <KeyboardAwareScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {view === 'hub' ? <MasterNavList items={DASHBOARD_SETTINGS_PAGES} /> : null}

        {/* Each house as its own board, so the choice is made on the rates
            themselves rather than on a name in a list. */}
        {view !== 'bullion' ? null : vendors.length > 0 ? (
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
            <AddBullionRow
              onAdd={addBullion}
              // No scroll of its own here: the keyboard-aware list lifts the
              // name field above the keyboard. Scrolling to the end as well
              // landed on the keyboard's empty bottom room and blanked the page.
            />
          </>
        ) : (
          <Text style={styles.loadingText}>Loading the bullion houses…</Text>
        )}

        {view === 'rate-view' ? (
          <>
            <Text style={styles.hint}>
              Choose which gold rates appear on your Home dashboard.
            </Text>
            <View style={styles.optionsCard}>
              {RATE_OPTIONS.map((option, index) => (
                <DropdownOption
                  key={option.key}
                  label={option.label}
                  selected={draft[option.key]}
                  onPress={toggleHandlers[option.key]}
                  mode="multi"
                  showDivider={index < RATE_OPTIONS.length - 1}
                />
              ))}
            </View>
          </>
        ) : null}
      </KeyboardAwareScrollView>

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
  flex: { flex: 1 },
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
  optionsCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.white,
    overflow: 'hidden',
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
