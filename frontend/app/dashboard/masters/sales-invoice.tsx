import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft } from 'lucide-react-native';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients, Spacing } from '@/constants/theme';
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

/** The mockup's `.reveal-collapse`: the Apply row slides open under a card. */
const REVEAL = {
  duration: 320,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

/**
 * The grey the mockup's disabled pill comes out as: the red gradient with
 * its colour taken out and shown at half strength over the white card.
 */
const APPLIED_GRADIENT = ['#C1C1C1', '#A3A3A3'];

/**
 * Three cards, one ticked. Tapping a card opens it to show an Apply button;
 * only one card is open at a time, and the ticked card's button reads
 * "Applied" and does nothing. Applying moves the tick and closes the card —
 * the design's `.sinv-card` list, as the shop asked for it.
 */
export default function SalesInvoiceScreen() {
  const router = useRouter();
  const [layout, setLayout] = useState<SalesInvoiceLayout | null>(null);
  const [open, setOpen] = useState<SalesInvoiceLayout | null>(null);
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

  const toggle = (value: SalesInvoiceLayout) => {
    LayoutAnimation.configureNext(REVEAL);
    setOpen((current) => (current === value ? null : value));
  };

  const apply = async (value: SalesInvoiceLayout) => {
    if (saving || value === layout) return;

    // Ticked and closed at once, because the choice is the shop's to make and
    // waiting on a round trip to show it makes the screen feel broken.
    const previous = layout;
    LayoutAnimation.configureNext(REVEAL);
    setLayout(value);
    setOpen(null);
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
            const applied = option.value === layout;
            const isOpen = option.value === open;
            return (
              <View key={option.value} style={[styles.card, applied && styles.cardApplied]}>
                <Pressable
                  onPress={() => toggle(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen, selected: applied }}
                  style={styles.head}
                >
                  <Text style={styles.headText}>
                    {option.parts.map((part, index) => (
                      <Text
                        key={index}
                        style={part.tone === 'muted' ? styles.headMuted : styles.headStrong}
                      >
                        {part.text}
                      </Text>
                    ))}
                  </Text>
                  {applied ? <Check size={18} color={Colors.accentGold} strokeWidth={3} /> : null}
                </Pressable>

                {isOpen ? (
                  <View style={styles.reveal}>
                    <Pressable
                      onPress={() => void apply(option.value)}
                      disabled={applied || saving}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: applied || saving }}
                      style={({ pressed }) => (pressed && !applied ? styles.applyPressed : null)}
                    >
                      <GradientView
                        colors={applied ? APPLIED_GRADIENT : Gradients.brand}
                        forceGradient
                        borderRadius={999}
                        style={styles.applyBtn}
                      >
                        <Text style={styles.applyText}>{applied ? 'Applied' : 'Apply'}</Text>
                      </GradientView>
                    </Pressable>
                  </View>
                ) : null}
              </View>
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
    // The design's `.sinv-list`: cards 10 apart.
    gap: 10,
  },
  loader: { marginTop: Spacing.xl },
  // `.sinv-card`: a white panel with the page's border, gold once applied.
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardApplied: { borderColor: Colors.accentGold },
  // `.sinv-head`
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 16,
  },
  headText: { flex: 1, fontSize: 14 },
  headStrong: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  headMuted: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  // `.reveal-inner` inside a card: 16 at the sides and foot, 4 above.
  reveal: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  // `.sinv-apply-btn`
  applyBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyPressed: { transform: [{ scale: 0.97 }] },
  applyText: { fontSize: 13.5, fontWeight: '800', color: Colors.white },
});
