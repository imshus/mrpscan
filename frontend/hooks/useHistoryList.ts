import { useCallback, useEffect, useRef, useState } from 'react';

import { isRequestAbortedError } from '@/utils/apiClient';
import type { HistoryPageFetcher } from '@/utils/historyApi';
import { appendHistoryPage, type HistoryPageRow } from '@/utils/historyFormat';
import { friendlyServerMessage } from '@/utils/serverMessages';
import { currentScopeGeneration } from '@/utils/userScopedStorage';

const LOAD_ERROR = 'Could not load this list.';

export interface HistoryListState {
  rows: HistoryPageRow[];
  /** The first page: on its way, shown, or failed with nothing to show. */
  phase: 'loading' | 'ready' | 'error';
  /** Why the first page, or a pull to refresh, failed. */
  error: string | null;
  refreshing: boolean;
  loadingMore: boolean;
  /** Why the next page failed; nothing more loads until it is asked for again. */
  moreError: string | null;
  hasMore: boolean;
}

const INITIAL: HistoryListState = {
  rows: [],
  phase: 'loading',
  error: null,
  refreshing: false,
  loadingMore: false,
  moreError: null,
  hasMore: false,
};

/**
 * One History list, a page at a time: the first page on open, the next one
 * as the list nears its end (`loadMore`), the first again on a pull
 * (`refresh`). `fetchPage` and `toRow` must be stable (module functions).
 *
 * Only the latest load counts: a refresh supersedes a next page still on its
 * way, whose rows would belong to the list as it was. A load that lands after
 * another account has signed in is dropped too — its rows are not this one's.
 */
export function useHistoryList<T>(
  fetchPage: HistoryPageFetcher<T>,
  toRow: (item: unknown, now: Date) => HistoryPageRow | null,
) {
  const [state, setState] = useState<HistoryListState>(INITIAL);
  const cursorRef = useRef<string | null>(null);
  const runRef = useRef(0);
  // Something is on its way: a next page waits rather than racing it.
  const busyRef = useRef(false);
  // A failed next page is not asked for again until its Try again: the end
  // of the list keeps firing while the user is there.
  const stalledRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  const loadFirst = useCallback(
    async (mode: 'open' | 'refresh') => {
      const run = ++runRef.current;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      busyRef.current = true;
      stalledRef.current = false;
      const generation = currentScopeGeneration();
      setState((prev) =>
        mode === 'refresh' ? { ...prev, refreshing: true, error: null, moreError: null } : INITIAL,
      );
      try {
        const page = await fetchPage(null, controller.signal);
        if (run !== runRef.current || generation !== currentScopeGeneration()) return;
        cursorRef.current = page.nextCursor;
        setState({
          ...INITIAL,
          rows: appendHistoryPage([], page.items, toRow),
          phase: 'ready',
          hasMore: page.nextCursor !== null,
        });
      } catch (error) {
        if (run !== runRef.current || generation !== currentScopeGeneration()) return;
        if (isRequestAbortedError(error)) return;
        const message = friendlyServerMessage(error, LOAD_ERROR);
        // A refresh that fails keeps the rows already shown, with the reason above them.
        setState((prev) =>
          mode === 'refresh' && prev.phase === 'ready'
            ? { ...prev, refreshing: false, error: message }
            : { ...INITIAL, phase: 'error', error: message },
        );
      } finally {
        if (run === runRef.current) busyRef.current = false;
      }
    },
    [fetchPage, toRow],
  );

  const loadNext = useCallback(
    async (retry: boolean) => {
      const cursor = cursorRef.current;
      if (!cursor || busyRef.current || (stalledRef.current && !retry)) return;
      busyRef.current = true;
      stalledRef.current = false;
      const run = runRef.current;
      const generation = currentScopeGeneration();
      setState((prev) => ({ ...prev, loadingMore: true, moreError: null }));
      try {
        const page = await fetchPage(cursor, controllerRef.current?.signal);
        if (run !== runRef.current || generation !== currentScopeGeneration()) return;
        cursorRef.current = page.nextCursor;
        setState((prev) => ({
          ...prev,
          rows: appendHistoryPage(prev.rows, page.items, toRow),
          loadingMore: false,
          hasMore: page.nextCursor !== null,
        }));
      } catch (error) {
        if (run !== runRef.current || generation !== currentScopeGeneration()) return;
        if (isRequestAbortedError(error)) return;
        stalledRef.current = true;
        setState((prev) => ({
          ...prev,
          loadingMore: false,
          moreError: friendlyServerMessage(error, LOAD_ERROR),
        }));
      } finally {
        if (run === runRef.current) busyRef.current = false;
      }
    },
    [fetchPage, toRow],
  );

  useEffect(() => {
    void loadFirst('open');
    return () => {
      // Leaving the page: whatever is still on its way is not wanted.
      runRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [loadFirst]);

  const reload = useCallback(() => void loadFirst('open'), [loadFirst]);
  const refresh = useCallback(() => void loadFirst('refresh'), [loadFirst]);
  const loadMore = useCallback(() => void loadNext(false), [loadNext]);
  const retryMore = useCallback(() => void loadNext(true), [loadNext]);

  return { ...state, reload, refresh, loadMore, retryMore };
}
