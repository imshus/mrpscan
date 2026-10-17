import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Spacing } from '@/constants/theme';
import { useHistoryList } from '@/hooks/useHistoryList';
import type { HistoryPageFetcher } from '@/utils/historyApi';
import { HISTORY_EMPTY_MESSAGE, type HistoryPageRow } from '@/utils/historyFormat';

interface HistoryListScreenProps<T> {
  title: string;
  fetchPage: HistoryPageFetcher<T>;
  toRow: (item: unknown, now: Date) => HistoryPageRow | null;
  /** Opens a row; a row with no id is not tappable. */
  onOpen: (row: HistoryPageRow) => void;
}

/**
 * One History list on a page of its own (Tag scan history, Wishlist history,
 * Checkout history): the rows in the History card's look (mockup .hc-card /
 * .hc-entry) — the item bold, when it happened muted under it, the price in
 * brand red — newest first. More load as the list nears its end; a pull
 * starts it again from the top.
 */
export function HistoryListScreen<T>({ title, fetchPage, toRow, onOpen }: HistoryListScreenProps<T>) {
  const list = useHistoryList(fetchPage, toRow);
  const lastIndex = list.rows.length - 1;

  const renderItem = useCallback<ListRenderItem<HistoryPageRow>>(
    ({ item, index }) => {
      const tappable = Boolean(item.id);
      return (
        <Pressable
          onPress={tappable ? () => onOpen(item) : undefined}
          disabled={!tappable}
          accessibilityRole={tappable ? 'button' : undefined}
          accessibilityLabel={`${item.title}, ${item.price}`}
          // A plain style, not a ({ pressed }) function: under NativeWind the
          // function form loses the background (see PopupCloseButton).
          style={[
            styles.entry,
            index === 0 && styles.entryFirst,
            index === lastIndex && styles.entryLast,
          ]}
        >
          <View style={styles.entryMain}>
            <Text style={styles.entryTitle}>{item.title}</Text>
            {item.sub ? <Text style={styles.entrySub}>{item.sub}</Text> : null}
          </View>
          <Text style={styles.entryPrice} numberOfLines={1}>
            {item.price}
          </Text>
        </Pressable>
      );
    },
    [lastIndex, onOpen],
  );

  const errorLine = (message: string, onRetry: () => void) => (
    <View style={styles.errorWrap}>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );

  // Nothing to list yet: the first page on its way, its failure, or an
  // empty list — each in the card's own slot.
  const empty =
    list.phase === 'loading' ? (
      <View style={[styles.statusCard, styles.statusLoading]}>
        <ActivityIndicator size="small" color={Colors.brandDeep} />
      </View>
    ) : list.phase === 'error' ? (
      <View style={styles.statusCard}>{errorLine(list.error ?? '', list.reload)}</View>
    ) : (
      <View style={styles.statusCard}>
        <Text style={styles.emptyText}>{HISTORY_EMPTY_MESSAGE}</Text>
      </View>
    );

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <FlatList
        data={list.rows}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <PageHeader title={title} />
            {/* A pull that failed keeps the rows it could not replace. */}
            {list.phase === 'ready' && list.error ? (
              <View style={styles.refreshError}>{errorLine(list.error, list.refresh)}</View>
            ) : null}
          </>
        }
        ListEmptyComponent={empty}
        ListFooterComponent={
          list.loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={Colors.brandDeep} />
            </View>
          ) : list.moreError ? (
            <View style={styles.footer}>{errorLine(list.moreError, list.retryMore)}</View>
          ) : null
        }
        onEndReached={list.hasMore ? list.loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={list.refreshing}
            onRefresh={list.refresh}
            colors={[Colors.brandDeep]}
            tintColor={Colors.brandDeep}
          />
        }
      />

      <BottomNav />
    </SafeAreaView>
  );
}

const CARD_RADIUS = 18;

const styles = StyleSheet.create({
  content: {
    paddingBottom: Spacing.screenBottom,
  },
  // Each row is a slice of one .hc-card: white, side borders, a hairline
  // between rows, the card's rounded corners on the first and the last.
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginHorizontal: Spacing.screenHorizontal,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  entryFirst: {
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
  },
  entryLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: CARD_RADIUS,
    borderBottomRightRadius: CARD_RADIUS,
  },
  entryMain: {
    flex: 1,
    gap: 2,
  },
  // .hc-entry-title: 0.82rem bold.
  entryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  // .hc-entry-sub: 0.7rem, dim, 600.
  entrySub: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  // .hc-entry-price: 0.8rem, 800, --gold-deep (the brand red).
  entryPrice: {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.brandDeep,
  },
  // .hc-empty inside the card: loading, a failed first page, or nothing yet.
  statusCard: {
    marginHorizontal: Spacing.screenHorizontal,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusLoading: {
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  refreshError: {
    marginHorizontal: Spacing.screenHorizontal,
    marginBottom: 12,
  },
  footer: {
    marginHorizontal: Spacing.screenHorizontal,
    paddingVertical: 14,
    alignItems: 'center',
  },
  errorWrap: {
    alignItems: 'flex-start',
    gap: 6,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.brandDeep,
  },
  retryText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.brandDeep,
    textDecorationLine: 'underline',
  },
});
