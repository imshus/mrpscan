import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { HistoryDetailScreen } from '@/components/history/HistoryDetailScreen';
import { apiFetchWishlistHistoryItem } from '@/utils/historyApi';
import { wishlistDetailView } from '@/utils/historyDetails';

/** Wishlist history → one add: the tag as it was saved to the wishlist, at the MRP it had then. */
export default function WishlistHistoryDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const load = useCallback(
    async (signal: AbortSignal) =>
      id ? wishlistDetailView(await apiFetchWishlistHistoryItem(id, signal)) : null,
    [id],
  );

  return <HistoryDetailScreen load={load} />;
}
