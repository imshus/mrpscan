import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { MatrixCheckboxRow } from '@/components/settings/MatrixCheckboxRow';
import { Colors, Spacing } from '@/constants/theme';
import { useRequireSettingsAccess } from '@/hooks/useSettingsAccess';
import { useMatricesStore } from '@/store/matricesStore';
import { updateDashboardMatrices } from '@/utils/matricesApi';

type DashboardMatrixKey =
  | '24k_mcx'
  | '24k_rtgs'
  | '24k_cash'
  | '22k_rtgs'
  | '22k_cash'
  | '20k_rtgs'
  | '20k_cash'
  | '18k_rtgs'
  | '18k_cash'
  | '14k_rtgs'
  | '14k_cash'
  | '9k_rtgs'
  | '9k_cash'
  | 'bhaw_source_jmd';

type DashboardMatrixValues = Record<DashboardMatrixKey, boolean>;

type DashboardMatrixSection = {
  sectionLabel: string;
  rows: Array<{ key: DashboardMatrixKey; label: string }>;
};

const DASHBOARD_MATRIX_SECTIONS: DashboardMatrixSection[] = [
  {
    sectionLabel: '24K GOLD',
    rows: [
      { key: '24k_mcx', label: ' MCX Rate ' },
      { key: '24k_rtgs', label: ' RTGS Rate ' },
      { key: '24k_cash', label: ' Cash Rate ' },
    ],
  },
  {
    sectionLabel: '22K GOLD',
    rows: [
      { key: '22k_rtgs', label: ' RTGS Rate ' },
      { key: '22k_cash', label: ' Cash Rate ' },
    ],
  },
  {
    sectionLabel: '20K GOLD',
    rows: [
      { key: '20k_rtgs', label: ' RTGS Rate ' },
      { key: '20k_cash', label: ' Cash Rate ' },
    ],
  },
  {
    sectionLabel: '18K GOLD',
    rows: [
      { key: '18k_rtgs', label: ' RTGS Rate ' },
      { key: '18k_cash', label: ' Cash Rate ' },
    ],
  },
  {
    sectionLabel: '14K GOLD',
    rows: [
      { key: '14k_rtgs', label: ' RTGS Rate ' },
      { key: '14k_cash', label: ' Cash Rate ' },
    ],
  },
  {
    sectionLabel: '9K GOLD',
    rows: [
      { key: '9k_rtgs', label: ' RTGS Rate ' },
      { key: '9k_cash', label: ' Cash Rate ' },
    ],
  },
];

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
  return {
    ...DEFAULT_DASHBOARD_MATRIX_VALUES,
    ...(values ?? {}),
  };
}

/** Radio row for the bhaw rate source (single-select, dot on the right). */
function RadioRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.radioRow}>
      <Text style={styles.radioLabel}>{label}</Text>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}

export default function DashboardMatricesScreen() {
  const allowed = useRequireSettingsAccess('matrices');
  const router = useRouter();
  const storedValues = useMatricesStore((s) => s.values);
  const [draft, setDraft] = useState<DashboardMatrixValues>(() => normalizeMatrixValues(storedValues));

  useEffect(() => {
    setDraft(normalizeMatrixValues(storedValues));
  }, [storedValues]);

  if (!allowed) return null;

  const persistToggle = async (
    key: DashboardMatrixKey,
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

  const toggle = (key: DashboardMatrixKey) => {
    const previousValue = draft[key];
    const nextValue = !previousValue;
    setDraft((current) => ({ ...current, [key]: nextValue }));
    void persistToggle(key, nextValue, previousValue);
  };

  const selectBhawSource = (useJmd: boolean) => {
    const previousValue = draft.bhaw_source_jmd;
    if (previousValue === useJmd) return;
    setDraft((current) => ({ ...current, bhaw_source_jmd: useJmd }));
    void persistToggle('bhaw_source_jmd', useJmd, previousValue);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.headerTitle}>Dashboard Settings</Text>
        </View>

        <Text style={styles.hint}>Choose which gold rates appear on your Home dashboard.</Text>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>
              Bhaw Rate Source — adjusts the gold rate on Home
            </Text>
          </View>
          <RadioRow
            label="JMD Patil"
            selected={draft.bhaw_source_jmd}
            onPress={() => selectBhawSource(true)}
          />
          <View style={styles.radioDivider} />
          <RadioRow
            label="Mega Bullion"
            selected={!draft.bhaw_source_jmd}
            onPress={() => selectBhawSource(false)}
          />

          {DASHBOARD_MATRIX_SECTIONS.map((section) => (
            <View key={section.sectionLabel}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section.sectionLabel}</Text>
              </View>
              {section.rows.map((row, index) => (
                <MatrixCheckboxRow
                  key={row.key}
                  label={row.label.trim()}
                  checked={draft[row.key]}
                  onToggle={() => toggle(row.key)}
                  showDivider={index < section.rows.length - 1}
                />
              ))}
            </View>
          ))}
        </View>
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
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  radioLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  radioDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.metalGold,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: Colors.metalGold,
  },
});
