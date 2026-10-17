import { apiRequest } from '@/utils/apiClient';
import { HISTORY_LIST_LIMIT } from '@/utils/historyFormat';

/**
 * Settings → History's own endpoints. Each of its pages reads its list a page
 * at a time, newest first; the owner's lists are the shop's, an employee's
 * their own (the server scopes all of them).
 */

/** One tag, as GET /history/scans returns it (newest first): read when scanning began, priced once a price came back. */
export interface ScanHistoryEntry {
  id: string;
  scanId: string;
  itemName: string;
  tagCode: string;
  finalMRP: number | null;
  status: 'read' | 'priced';
  createdAt: string;
}

/* ==================== History pages: lists a page at a time, and one entry ====================
 *
 * A page's `nextCursor` asks for the page after it (?before=), and null means
 * the list has ended. Entries are typed for reading, but the rows and the
 * details page read them defensively (utils/historyFormat, utils/historyDetails):
 * any field may be missing.
 */

/** GET /history/scans/:scanId — the tag as read (`details`) and as priced (`pricing`, null when only read). */
export interface ScanHistoryDetail extends Omit<ScanHistoryEntry, 'id'> {
  updatedAt?: string;
  details?: Record<string, unknown> | null;
  pricing?: Record<string, unknown> | null;
}

/** One wishlist add, as GET /history/wishlist lists it. */
export interface WishlistHistoryEntry {
  id: string;
  itemName: string;
  tagCode: string;
  mrp: number;
  createdAt: string;
}

/** GET /history/wishlist/:id — `snapshot` is the item as the app saved it to the wishlist. */
export interface WishlistHistoryDetail extends WishlistHistoryEntry {
  snapshot?: Record<string, unknown> | null;
}

/** One checkout (an invoice), as GET /history/checkouts lists it. */
export interface CheckoutHistoryEntry {
  id: string;
  invoiceNumber: string;
  pieceCount: number;
  pieces: { itemName: string; tagCode: string; mrp: number }[];
  grandTotal: number;
  createdAt: string;
}

export interface HistoryPage<T> {
  items: T[];
  /** The cursor for the next page; null when this was the last. */
  nextCursor: string | null;
}

export type HistoryPageFetcher<T> = (before: string | null, signal?: AbortSignal) => Promise<HistoryPage<T>>;

async function fetchHistoryPage<T>(
  path: string,
  before: string | null,
  signal?: AbortSignal,
): Promise<HistoryPage<T>> {
  const query = [`limit=${encodeURIComponent(String(HISTORY_LIST_LIMIT))}`];
  if (before) query.push(`before=${encodeURIComponent(before)}`);
  const res = await apiRequest<{ success: boolean; data?: { items?: T[]; nextCursor?: string | null } }>(
    `${path}?${query.join('&')}`,
    { signal },
  );
  const cursor = res.data?.nextCursor;
  return {
    items: Array.isArray(res.data?.items) ? res.data.items : [],
    nextCursor: typeof cursor === 'string' && cursor ? cursor : null,
  };
}

async function fetchHistoryItem<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const res = await apiRequest<{ success: boolean; data?: { item?: T | null } }>(path, { signal });
  return res.data?.item ?? null;
}

/** GET /history/scans?limit&before — every tag scanned, priced or only read. */
export const apiFetchScanHistoryPage: HistoryPageFetcher<ScanHistoryEntry> = (before, signal) =>
  fetchHistoryPage('/history/scans', before, signal);

/** GET /history/wishlist?limit&before — every add to the wishlist, kept after the item leaves it. */
export const apiFetchWishlistHistoryPage: HistoryPageFetcher<WishlistHistoryEntry> = (before, signal) =>
  fetchHistoryPage('/history/wishlist', before, signal);

/** GET /history/checkouts?limit&before — the invoices made, with their pieces. */
export const apiFetchCheckoutHistoryPage: HistoryPageFetcher<CheckoutHistoryEntry> = (before, signal) =>
  fetchHistoryPage('/history/checkouts', before, signal);

/** GET /history/scans/:scanId */
export function apiFetchScanHistoryItem(scanId: string, signal?: AbortSignal): Promise<ScanHistoryDetail | null> {
  return fetchHistoryItem(`/history/scans/${encodeURIComponent(scanId)}`, signal);
}

/** GET /history/wishlist/:id */
export function apiFetchWishlistHistoryItem(id: string, signal?: AbortSignal): Promise<WishlistHistoryDetail | null> {
  return fetchHistoryItem(`/history/wishlist/${encodeURIComponent(id)}`, signal);
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
