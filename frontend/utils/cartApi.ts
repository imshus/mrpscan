import { apiRequest } from '@/utils/apiClient';
import { readCheckoutDetail, type CheckoutDetail } from '@/utils/cartInvoice';

/**
 * GET /history/checkouts/:id — one past cart: the invoice that billed it,
 * its pieces and its grand total, for the cart page to show read-only.
 * Null when the server sent no record.
 */
export async function apiFetchCheckout(invoiceId: string): Promise<CheckoutDetail | null> {
  const res = await apiRequest<{ success: boolean; data?: { item?: unknown } }>(
    `/history/checkouts/${encodeURIComponent(invoiceId)}`,
  );
  return readCheckoutDetail(res.data?.item);
}
