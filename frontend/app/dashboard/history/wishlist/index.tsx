import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

import { HistoryListScreen } from '@/components/history/HistoryListScreen';
import { apiFetchWishlistHistoryPage } from '@/utils/historyApi';
import { wishlistPageRow, type HistoryPageRow } from '@/utils/historyFormat';

/**
 * Settings → History → Wishlist history: every time a tag was added to the
 * wishlist, newest first, kept after it leaves the wishlist. A tap opens the
 * tag as it was added.
 */
export default function WishlistHistoryScreen() {
  const router = useRouter();
  const open = useCallback(
    (row: HistoryPageRow) =>
      router.push({
        pathname: '/dashboard/history/wishlist/[id]',
        params: { id: row.id },
      } as unknown as Href),
    [router],
  );

  return (
    <HistoryListScreen
      title="Wishlist history"
      fetchPage={apiFetchWishlistHistoryPage}
      toRow={wishlistPageRow}
      onOpen={open}
    />
  );
}
