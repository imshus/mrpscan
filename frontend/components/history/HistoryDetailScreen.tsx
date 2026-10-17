import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { TagDetails } from '@/components/history/TagDetails';
import { CardHeader, FloatingCard } from '@/components/scanner/ReviewCardKit';
import { PriceCard } from '@/components/scanner/PriceCard';
import { Colors } from '@/constants/theme';
import { ApiError, isRequestAbortedError } from '@/utils/apiClient';
import type { TagDetailView } from '@/utils/historyDetails';
import { friendlyServerMessage } from '@/utils/serverMessages';
import { currentScopeGeneration } from '@/utils/userScopedStorage';

const GONE_MESSAGE = 'This entry is no longer in the history.';

/**
 * The server's own refusal for an entry it does not have (history is kept
 * six months) is JSON; a server without the route answers a bare 404, which
 * friendlyServerMessage already words as "not available yet".
 */
function detailErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404 && error.body && typeof error.body === 'object') {
    return GONE_MESSAGE;
  }
  return friendlyServerMessage(error, 'Could not load this tag.');
}

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; view: TagDetailView }
  | { status: 'error'; message: string };

interface HistoryDetailScreenProps {
  /** Fetches the entry and reads it into the view; must be stable for one entry (useCallback). */
  load: (signal: AbortSignal) => Promise<TagDetailView | null>;
}

/**
 * One past tag from History (a scan or a wishlist add), laid out as the
 * scanner's result card — the floating card, the MRP banner on top, the
 * tiles under it — but read-only, with nothing to edit, wishlist or invoice.
 */
export function HistoryDetailScreen({ load }: HistoryDetailScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const generation = currentScopeGeneration();
    setState({ status: 'loading' });
    // Dropped once the page is left, or once another account has signed in:
    // the entry is not theirs.
    const stale = () => controller.signal.aborted || generation !== currentScopeGeneration();
    load(controller.signal).then(
      (view) => {
        if (stale()) return;
        setState(view ? { status: 'ready', view } : { status: 'error', message: GONE_MESSAGE });
      },
      (error: unknown) => {
        if (stale() || isRequestAbortedError(error)) return;
        setState({ status: 'error', message: detailErrorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [load, attempt]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/dashboard/history' as Href);
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        {/* As the result card: 8 top / 16 sides, and room for the nav pill below. */}
        <View style={[styles.wrap, { paddingBottom: insets.bottom + 76 }]}>
          <FloatingCard>
            <CardHeader title="Tag Details" onBack={handleBack}>
              <PriceCard
                label="MRP Rate Amount"
                amount={state.status === 'ready' ? state.view.mrp : '—'}
                style={styles.mrpCard}
              />
              {state.status === 'ready' && state.view.note ? (
                <Text style={styles.note}>{state.view.note}</Text>
              ) : null}
            </CardHeader>

            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {state.status === 'loading' ? (
                <View style={styles.status}>
                  <ActivityIndicator size="small" color={Colors.brandDeep} />
                </View>
              ) : state.status === 'error' ? (
                <View style={styles.status}>
                  <Text style={styles.errorText}>{state.message}</Text>
                  <Pressable onPress={() => setAttempt((n) => n + 1)} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.retryText}>Try again</Text>
                  </Pressable>
                </View>
              ) : (
                <TagDetails view={state.view} />
              )}
            </ScrollView>
          </FloatingCard>
        </View>
      </SafeAreaView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  wrap: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  mrpCard: {
    marginBottom: 0,
  },
  note: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  scrollContent: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  status: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.brandDeep,
    textAlign: 'center',
  },
  retryText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.brandDeep,
    textDecorationLine: 'underline',
  },
});
