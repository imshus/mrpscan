import { useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Spacing } from '@/constants/theme';
import { apiFetchScanHistory } from '@/utils/historyApi';
import {
  HISTORY_EMPTY_MESSAGE,
  HISTORY_LIST_LIMIT,
  checkoutHistoryRow,
  historyRows,
  scanHistoryRow,
  wishlistHistoryRow,
  type HistoryRow,
} from '@/utils/historyFormat';
import { apiFetchInvoices } from '@/utils/invoiceApi';
import { friendlyServerMessage } from '@/utils/serverMessages';
import { currentScopeGeneration } from '@/utils/userScopedStorage';
import { apiFetchWishlist } from '@/utils/wishlistApi';

type SectionKey = 'scans' | 'wishlist' | 'checkout';

const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: 'scans', title: 'Tag scan history' },
  { key: 'wishlist', title: 'Wishlist history' },
  { key: 'checkout', title: 'Checkout history' },
];

interface SectionState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  rows: HistoryRow[];
  error: string | null;
}

const IDLE: SectionState = { status: 'idle', rows: [], error: null };

/** Each list's rows, fetched fresh; the times are read against the same "now". */
async function loadSectionRows(key: SectionKey): Promise<HistoryRow[]> {
  const now = new Date();
  switch (key) {
    case 'scans':
      return historyRows(await apiFetchScanHistory(), (item) => scanHistoryRow(item, now));
    case 'wishlist':
      return historyRows(await apiFetchWishlist(), (item) => wishlistHistoryRow(item, now));
    case 'checkout':
      return historyRows(await apiFetchInvoices(HISTORY_LIST_LIMIT), (item) => checkoutHistoryRow(item, now));
  }
}

/**
 * History (mockup #screenHistoryCart), from Settings: one card of three rows
 * that open in place — the tags priced at the counter, what went on the
 * wishlist, and the invoices made. Each list is fetched the first time its
 * row is opened, not before. The owner sees the shop's; an employee their
 * own (the server scopes all three).
 *
 * Rows are not tappable: the app has no screen that shows a past invoice or
 * a past scan on its own.
 */
export default function HistoryScreen() {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    scans: false,
    wishlist: false,
    checkout: false,
  });
  const [sections, setSections] = useState<Record<SectionKey, SectionState>>({
    scans: IDLE,
    wishlist: IDLE,
    checkout: IDLE,
  });

  const load = async (key: SectionKey) => {
    const generation = currentScopeGeneration();
    setSections((prev) => ({ ...prev, [key]: { ...prev[key], status: 'loading', error: null } }));
    try {
      const rows = await loadSectionRows(key);
      // Another account signed in while it loaded: its lists are not this one's.
      if (generation !== currentScopeGeneration()) return;
      setSections((prev) => ({ ...prev, [key]: { status: 'ready', rows, error: null } }));
    } catch (error) {
      if (generation !== currentScopeGeneration()) return;
      setSections((prev) => ({
        ...prev,
        [key]: { status: 'error', rows: [], error: friendlyServerMessage(error, 'Could not load this list.') },
      }));
    }
  };

  const toggle = (key: SectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const opening = !open[key];
    setOpen((prev) => ({ ...prev, [key]: opening }));
    if (opening && sections[key].status === 'idle') void load(key);
  };

  const renderBody = (key: SectionKey) => {
    const section = sections[key];
    if (section.status === 'idle' || section.status === 'loading') {
      return (
        <View style={[styles.status, styles.statusLoading]}>
          <ActivityIndicator size="small" color={Colors.brandDeep} />
        </View>
      );
    }
    if (section.status === 'error') {
      return (
        <View style={styles.status}>
          <Text style={styles.errorText}>{section.error}</Text>
          <Pressable onPress={() => void load(key)} hitSlop={8} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    if (section.rows.length === 0) {
      return (
        <View style={styles.status}>
          <Text style={styles.emptyText}>{HISTORY_EMPTY_MESSAGE}</Text>
        </View>
      );
    }
    return (
      <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {section.rows.map((row, index) => (
          <View key={row.key || String(index)} style={styles.entry}>
            <View style={styles.entryMain}>
              <Text style={styles.entryTitle}>{row.title}</Text>
              {row.sub ? <Text style={styles.entrySub}>{row.sub}</Text> : null}
            </View>
            <Text style={styles.entryPrice} numberOfLines={1}>
              {row.price}
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={screenStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="History" />

        <View style={styles.card}>
          {SECTIONS.map(({ key, title }, index) => (
            <View key={key} style={index > 0 ? styles.tileDivider : null}>
              <Pressable
                onPress={() => toggle(key)}
                style={styles.head}
                accessibilityRole="button"
                accessibilityState={{ expanded: open[key] }}
              >
                <Text style={styles.headText}>{title}</Text>
                <ChevronDown
                  size={16}
                  color={Colors.textMuted}
                  strokeWidth={2.2}
                  style={open[key] ? styles.chevronOpen : null}
                />
              </Pressable>
              {open[key] ? <View style={styles.body}>{renderBody(key)}</View> : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  // .hc-card: panel, 1px border, radius 18, a soft drop shadow.
  card: {
    marginHorizontal: Spacing.screenHorizontal,
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#15120D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 1,
  },
  // .hc-tile: a hairline between rows, none above the first.
  tileDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  // .hc-head: 14/16, 0.88rem bold.
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  headText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  // .hc-body: the page's cream under the white card.
  body: {
    backgroundColor: Colors.background,
  },
  // .hc-body.show: max-height 440, scrolling inside.
  list: {
    maxHeight: 440,
  },
  // .hc-entry: 11/16, hairline above.
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  entryMain: {
    flex: 1,
    gap: 2,
  },
  entryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  entrySub: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  entryPrice: {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.brandDeep,
  },
  // .hc-empty: 14/16, 0.78rem dim, hairline above. Loading and errors sit in
  // the same slot.
  status: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'flex-start',
    gap: 6,
  },
  statusLoading: {
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.brandDeep,
  },
  retry: {
    alignSelf: 'flex-start',
  },
  retryText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.brandDeep,
    textDecorationLine: 'underline',
  },
});
