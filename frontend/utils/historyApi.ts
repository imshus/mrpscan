import { apiRequest } from '@/utils/apiClient';
import { HISTORY_LIST_LIMIT } from '@/utils/historyFormat';

/**
 * The two lists Settings → History reads that nothing else does. The
 * wishlist section reuses apiFetchWishlist as it is.
 */

/** One priced tag, as GET /history/scans returns it (newest first). */
export interface ScanHistoryEntry {
  scanId: string;
  itemName: string;
  tagCode: string;
  finalMRP: number;
  createdAt: string;
}

/**
 * GET /history/scans — the tags priced at the counter, the latest price per
 * tag. The owner's list is the shop's; an employee's is their own.
 */
export async function apiFetchScanHistory(limit: number = HISTORY_LIST_LIMIT): Promise<ScanHistoryEntry[]> {
  const res = await apiRequest<{ success: boolean; data?: { items?: ScanHistoryEntry[] } }>(
    `/history/scans?limit=${encodeURIComponent(String(limit))}`,
  );
  return Array.isArray(res.data?.items) ? res.data.items : [];
}

/**
 * A row of GET /invoices as the checkout list reads it: the list leaves the
 * line items out, and says how many pieces were billed instead (absent on
 * invoices issued before the server counted them).
 */
export interface CheckoutHistoryEntry {
  _id: string;
  invoiceNumber: string;
  grandTotal: number;
  pieceCount?: number;
  createdAt: string;
}

/** GET /invoices — newest first; an employee's are their own. */
export async function apiFetchCheckoutHistory(limit: number = HISTORY_LIST_LIMIT): Promise<CheckoutHistoryEntry[]> {
  const res = await apiRequest<{ success: boolean; data?: { invoices?: CheckoutHistoryEntry[] } }>(
    `/invoices?limit=${encodeURIComponent(String(limit))}`,
  );
  return Array.isArray(res.data?.invoices) ? res.data.invoices : [];
}
