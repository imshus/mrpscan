import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import {
  DropdownGroupLabel,
  DropdownOption,
  SettingsDropdown,
} from '@/components/settings/SettingsDropdown';
import {
  ALWAYS_ON_MATRIX_KEYS,
  GOLD_MATRIX_SECTIONS,
  type MatrixKey,
} from '@/constants/dashboardMatrices';
import { Colors, Spacing } from '@/constants/theme';
import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';
import { useMatricesStore } from '@/store/matricesStore';
import { updateDashboardMatrices } from '@/utils/matricesApi';

type DashboardMatrixValues = Record<MatrixKey, boolean>;

/** Which bullion house the Home gold rate follows. */
const BULLION_CHOICES: { label: string; jmd: boolean }[] = [
  { label: 'JMD Patil', jmd: true },
  { label: 'Mega Bullion', jmd: false },
];

interface RateOption {
  key: MatrixKey;
  /** The karat band this rate sits under, e.g. "24K GOLD". */
  group: string;
  /** The line in the menu, e.g. "MCX Rate". */
  label: string;
  /** The name used in the closed box, e.g. "24K MCX". */
  short: string;
}

/**
 * Every rate the Home dashboard can show, in the order it appears there:
 * 24K MCX / RTGS / Cash first, then 22K and the lighter karats.
 */
const RATE_OPTIONS: RateOption[] = GOLD_MATRIX_SECTIONS.flatMap((section) =>
  section.rows.map((row) => {
    const label = row.label.trim();
    const karat = section.sectionLabel.replace(' GOLD', '');
    return {
      key: row.key,
      group: section.sectionLabel,
      label,
      short: `${karat} ${label.replace(' Rate', '')}`,
    };
  }),
);

const DEFAULT_DASHBOARD_MATRIX_VALUES: DashboardMatrixValues = {
  '24k_mcx': true,
  '24k_rtgs': true,
  '24k_cash': true,
  '22k_rtgs': true,
  '22k_cash': true,
  '20k_rtgs': true,
  '20k_cash': true,
  '18k_rtgs': true,
  '18k_cash': true,
  '14k_rtgs': true,
  '14k_cash': true,
  '9k_rtgs': true,
  '9k_cash': true,
  'bhaw_source_jmd': false,
};

function normalizeMatrixValues(values: Record<string, boolean> | null | undefined): DashboardMatrixValues {
  const merged: DashboardMatrixValues = {
    ...DEFAULT_DASHBOARD_MATRIX_VALUES,
    ...(values ?? {}),
  };
  // Whatever a record saved before this rule says, the 24K rates are on.
  for (const key of ALWAYS_ON_MATRIX_KEYS) merged[key] = true;
  return merged;
}

/** What the closed karat box reads: the chosen rates, and how many more. */
function summarizeRates(values: DashboardMatrixValues): string {
  const chosen = RATE_OPTIONS.filter((option) => values[option.key]);
  if (chosen.length === 0) return 'No rates on Home';
  if (chosen.length === RATE_OPTIONS.length) return 'All rates';
  const named = chosen.slice(0, 2).map((option) => option.short).join(', ');
  return chosen.length > 2 ? `${named} +${chosen.length - 2}` : named;
}

export default function DashboardMatricesScreen() {
  const allowed = useRequireSettingsAccess('matrices');
  const router = useRouter();
  const storedValues = useMatricesStore((s) => s.values);
  const [draft, setDraft] = useState<DashboardMatrixValues>(() => normalizeMatrixValues(storedValues));
  // One menu at a time, so a long karat list never hides the field above it.
  const [openMenu, setOpenMenu] = useState<'bullion' | 'karat' | null>(null);

  useEffect(() => {
    setDraft(normalizeMatrixValues(storedValues));
  }, [storedValues]);

  const rateSummary = useMemo(() => summarizeRates(draft), [draft]);

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
      Alert.alert('Unable to save dashboard settings', 'The change could not be saved. Please try again.');
      console.error('Failed to update dashboard matrices', error);
    }
  };

  const toggleRate = (key: MatrixKey) => {
    if (ALWAYS_ON_MATRIX_KEYS.includes(key)) return;
    const previousValue = draft[key];
    const nextValue = !previousValue;
    setDraft((current) => ({ ...current, [key]: nextValue }));
    void persistToggle(key, nextValue, previousValue);
  };

  const selectBullion = (useJmd: boolean) => {
    // A single choice: the menu closes on the way out, whether or not it moved.
    setOpenMenu(null);
    const previousValue = draft.bhaw_source_jmd;
    if (previousValue === useJmd) return;
    setDraft((current) => ({ ...current, bhaw_source_jmd: useJmd }));
    void persistToggle('bhaw_source_jmd', useJmd, previousValue);
  };

  const bullionLabel = draft.bhaw_source_jmd ? 'JMD Patil' : 'Mega Bullion';

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
          Choose the bullion house the Home rate follows, and which gold rates appear there.
        </Text>

        <SettingsDropdown
          label="Choose Bullion"
          value={bullionLabel}
          open={openMenu === 'bullion'}
          onPress={() => setOpenMenu((current) => (current === 'bullion' ? null : 'bullion'))}
        >
          {BULLION_CHOICES.map((choice, index) => (
            <DropdownOption
              key={choice.label}
              label={choice.label}
              selected={draft.bhaw_source_jmd === choice.jmd}
              onPress={() => selectBullion(choice.jmd)}
              showDivider={index < BULLION_CHOICES.length - 1}
            />
          ))}
        </SettingsDropdown>

        <SettingsDropdown
          label="Choose Karat"
          value={rateSummary}
          open={openMenu === 'karat'}
          onPress={() => setOpenMenu((current) => (current === 'karat' ? null : 'karat'))}
        >
          {RATE_OPTIONS.map((option, index) => {
            const previous = RATE_OPTIONS[index - 1];
            const isLast = index === RATE_OPTIONS.length - 1;
            return (
              <View key={option.key}>
                {previous?.group !== option.group ? <DropdownGroupLabel label={option.group} /> : null}
                <DropdownOption
                  label={option.label}
                  selected={draft[option.key]}
                  onPress={() => toggleRate(option.key)}
                  mode="multi"
                  locked={ALWAYS_ON_MATRIX_KEYS.includes(option.key)}
                  lockedHint="Always on"
                  showDivider={!isLast && RATE_OPTIONS[index + 1]?.group === option.group}
                />
              </View>
            );
          })}
        </SettingsDropdown>
      </ScrollView>

      <BottomNav activeRoute="home" />
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
});
