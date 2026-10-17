import { apiRequest } from '@/utils/apiClient';
import { HISTORY_LIST_LIMIT } from '@/utils/historyFormat';

/**
 * The list Settings → History reads that nothing else does. The wishlist and
 * checkout sections reuse apiFetchWishlist and apiFetchInvoices as they are.
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
