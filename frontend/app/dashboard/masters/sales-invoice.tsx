import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft } from 'lucide-react-native';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { SalesInvoiceLayout } from '@/types/formulaSettings';
import { fetchFormulaSettings, updateFormulaSettings } from '@/utils/formulaSettingsApi';
import { friendlyServerMessage } from '@/utils/serverMessages';

/**
 * How a sales invoice groups what was scanned.
 *
 * Each option is the same money arranged differently: a shop that quotes one
 * figure for the metal and its making puts labour inside the gold line, and
 * one that quotes wastage instead puts that there. The parts are named in the
 * order they appear on the invoice, so the label reads like the document.
 */
const OPTIONS: { value: SalesInvoiceLayout; parts: { text: string; tone?: 'muted' }[] }[] = [
  {
    value: 'SEPARATE',
    parts: [{ text: 'Gold, Diamond, Labour' }, { text: ' + Tax', tone: 'muted' }],
  },
  {
    value: 'GOLD_WITH_LABOUR',
    parts: [{ text: '(Gold + Labour), Diamond' }, { text: ' + Tax', tone: 'muted' }],
  },
  {
    value: 'GOLD_WITH_WASTAGE',
    parts: [{ text: '(Gold + Wastage), Diamond' }, { text: ' + Tax', tone: 'muted' }],
  },
];

export default function SalesInvoiceScreen() {
  const router = useRouter();
  const [layout, setLayout] = useState<SalesInvoiceLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await fetchFormulaSettings();
      setLayout(settings.salesInvoiceLayout);
    } catch (error) {
      Alert.alert(
        'Sales Invoice',
        error instanceof Error ? error.message : 'Could not load this setting.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const choose = async (value: SalesInvoiceLayout) => {
    if (saving || value === layout) return;

    // Ticked at once, because the choice is the shop's to make and waiting on
    // a round trip to show it makes the screen feel broken.
    const previous = layout;
    setLayout(value);
    setSaving(true);
    try {
      const settings = await fetchFormulaSettings();
      const saved = await updateFormulaSettings({
        activeFormula: settings.activeFormula,
        formula2Rules: settings.formula2Rules,
        salesInvoiceLayout: value,
      });

      // The request succeeded but the answer is not what was asked for, which
      // means the API does not know this setting yet: an older deployment
      // drops the field and replies with the default. Say that, rather than
      // moving the tick back and leaving the shop to wonder why.
      if (saved.salesInvoiceLayout !== value) {
        setLayout(previous);
        Alert.alert(
          'Sales Invoice',
          'This setting is not available on the server yet, so the choice could not be saved.',
        );
        return;
      }

      setLayout(saved.salesInvoiceLayout);
    } catch (error) {
      setLayout(previous);
      Alert.alert('Sales Invoice', friendlyServerMessage(error, 'Could not save this setting.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.2} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Sales Invoice</Text>
          <Text style={styles.headerCrumb}>Settings → Masters → Sales Invoice</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={styles.loader} />
        ) : (
          OPTIONS.map((option) => {
            const selected = option.value === layout;
            return (
              <Pressable
                key={option.value}
                onPress={() => void choose(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text style={styles.optionText}>
                  {option.parts.map((part, index) => (
                    <Text
                      key={index}
                      style={part.tone === 'muted' ? styles.optionMuted : styles.optionStrong}
                    >
                      {part.text}
                    </Text>
                  ))}
                </Text>
                {selected ? (
                  <Check size={16} color={Colors.accentGold} strokeWidth={3} />
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundAlt,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  headerCrumb: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 110,
    gap: Spacing.md,
  },
  loader: { marginTop: Spacing.xl },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.tile,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 18,
  },
  optionSelected: { borderColor: Colors.accentGold, borderWidth: 1.5 },
  optionText: { flex: 1, fontSize: 14 },
  optionStrong: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  optionMuted: { fontSize: 14, fontWeight: '700', color: Colors.accentGold },
});
