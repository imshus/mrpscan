import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

import { HistoryListScreen } from '@/components/history/HistoryListScreen';
import { apiFetchCheckoutHistoryPage } from '@/utils/historyApi';
import { checkoutPageRow, type HistoryPageRow } from '@/utils/historyFormat';

/**
 * Settings → History → Checkout history: the carts billed, newest first. A
 * tap opens that cart on the cart page, read-only (it loads the invoice by
 * its id).
 */
export default function CheckoutHistoryScreen() {
  const router = useRouter();
  const open = useCallback(
    (row: HistoryPageRow) =>
      router.push({ pathname: '/dashboard/cart', params: { invoiceId: row.id } } as unknown as Href),
    [router],
  );

  return (
    <HistoryListScreen
      title="Checkout history"
      fetchPage={apiFetchCheckoutHistoryPage}
      toRow={checkoutPageRow}
      onOpen={open}
    />
  );
}
