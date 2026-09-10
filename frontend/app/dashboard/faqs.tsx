import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronRight, Globe, Search } from 'lucide-react-native';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { fetchFaqs, type FaqLanguage, type FaqSection } from '@/utils/faqApi';

const LANGUAGE_CHOICES: { value: FaqLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी' },
];

/**
 * The FAQ, as the mockup lays it out: a search box with a language globe
 * beside it, then one card per section — GOLD, DIAMOND and the rest — whose
 * numbered questions open in place to show their answer.
 *
 * Every question and answer is stored in English and Hindi, so the globe
 * switches language without another request.
 */
export default function FaqsScreen() {
  const [sections, setSections] = useState<FaqSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<FaqLanguage>('en');
  const [query, setQuery] = useState('');
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());
  // Sections start closed: nine of them make a long page, and the closed list
  // reads as an index of what the help covers.
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [languageOpen, setLanguageOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const globeRef = useRef<View>(null);
  const { width: screenWidth } = useWindowDimensions();

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const rows = await fetchFaqs();
      setSections(rows);
      if (!rows.length) setError('No questions have been published yet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the FAQs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Searching looks at both the question and its answer, in the language on
  // screen; a section with nothing left to show drops out entirely.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sections;
    return sections
      .map((section) => ({
        section: section.section,
        items: section.items.filter(
          (item) =>
            item.q[language].toLowerCase().includes(needle) ||
            item.a[language].toLowerCase().includes(needle) ||
            section.section[language].toLowerCase().includes(needle),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, query, language]);

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="FAQs" />

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={language === 'hi' ? 'सवाल खोजें' : 'Search FAQs'}
            placeholderTextColor={Colors.placeholder}
            style={styles.searchInput}
          />
        </View>
        <Pressable
          ref={globeRef}
          onPress={() => {
            globeRef.current?.measureInWindow((x, y, width, height) => {
              setAnchor({ x, y, width, height });
              setLanguageOpen(true);
            });
          }}
          accessibilityRole="button"
          accessibilityLabel="Choose the language"
          style={styles.globeBtn}
        >
          <Globe size={18} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <Modal visible={languageOpen} transparent animationType="none" onRequestClose={() => setLanguageOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setLanguageOpen(false)}>
          {anchor ? (
            <View
              style={[
                styles.menu,
                {
                  top: anchor.y + anchor.height + 6,
                  right: Math.max(8, screenWidth - (anchor.x + anchor.width)),
                },
              ]}
            >
              {LANGUAGE_CHOICES.map((choice) => {
                const selected = choice.value === language;
                return (
                  <Pressable
                    key={choice.value}
                    onPress={() => {
                      setLanguage(choice.value);
                      setLanguageOpen(false);
                    }}
                    style={styles.menuRow}
                  >
                    <Text style={[styles.menuText, selected && styles.menuTextSelected]}>
                      {choice.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={Colors.brandDeep} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : visible.length === 0 ? (
          <Text style={styles.errorText}>
            {language === 'hi' ? 'कोई सवाल नहीं मिला।' : 'No question matches your search.'}
          </Text>
        ) : (
          visible.map((section) => {
            const sectionKey = section.section.en;
            // A search shows what it found, without asking for another tap.
            const open = openSections.has(sectionKey) || query.trim().length > 0;
            return (
              <View key={sectionKey} style={styles.sectionCard}>
                <Pressable
                  onPress={() => setOpenSections((current) => toggle(current, sectionKey))}
                  style={styles.sectionHeader}
                >
                  <Text style={styles.sectionTitle}>
                    {section.section[language].toUpperCase()}
                  </Text>
                  {open ? (
                    <ChevronDown size={16} color={Colors.brandDeep} />
                  ) : (
                    <ChevronRight size={16} color={Colors.brandDeep} />
                  )}
                </Pressable>

                {open
                  ? section.items.map((item, index) => {
                      const key = `${sectionKey}:${index}`;
                      const expanded = openQuestions.has(key);
                      return (
                        <View key={key} style={[styles.qaRow, index > 0 && styles.qaDivider]}>
                          <Pressable
                            onPress={() => setOpenQuestions((current) => toggle(current, key))}
                            style={styles.qRow}
                          >
                            <Text style={styles.qIndex}>{index + 1}.</Text>
                            <Text style={styles.qText}>{item.q[language]}</Text>
                            {expanded ? (
                              <ChevronDown size={15} color={Colors.textMuted} />
                            ) : (
                              <ChevronRight size={15} color={Colors.textMuted} />
                            )}
                          </Pressable>
                          {expanded ? (
                            <Text style={styles.aText}>{item.a[language]}</Text>
                          ) : null}
                        </View>
                      );
                    })
                  : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    padding: 0,
  },
  globeBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBackdrop: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    minWidth: 132,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 4,
    elevation: 8,
    shadowColor: '#15120D',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  menuRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  menuText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  menuTextSelected: {
    color: Colors.brandDeep,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.screenBottom,
    gap: Spacing.md,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.tile,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.metalGoldBg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 11,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.brandDeep,
  },
  qaRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  qaDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  qRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  qIndex: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.brandDeep,
    paddingTop: 1,
  },
  qText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: Colors.brandDeep,
  },
  aText: {
    marginTop: 8,
    marginLeft: 20,
    fontSize: 12.5,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  centerState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorText: {
    paddingVertical: 32,
    textAlign: 'center',
    fontSize: 13,
    color: Colors.textMuted,
  },
});
