import { apiRequest } from '@/utils/apiClient';
import type { WishlistItem } from '@/types/wishlist';

interface ApiWishlistItem {
  itemId: string;
  title: string;
  tagCode: string;
  totalMrp: number;
  priceBadge: string;
  calculationRate?: 'rtgs' | 'cash';
  scanTimestamp: string;
  snapshot: WishlistItem['snapshot'];
  createdAt: string;
}

interface AddWishlistPayload {
  itemId: string;
  title: string;
  tagCode: string;
  totalMrp: number;
  priceBadge: string;
  calculationRate?: 'rtgs' | 'cash';
  scanTimestamp: string;
  snapshot: WishlistItem['snapshot'];
}

function mapApiItemToWishlistItem(raw: ApiWishlistItem): WishlistItem {
  return {
    id: raw.itemId,
    title: raw.title,
    tagCode: raw.tagCode,
    priceBadge: raw.priceBadge,
    calculationRate: raw.calculationRate,
    totalMrp: raw.totalMrp,
    addedAt: raw.createdAt,
    scanTimestamp: raw.scanTimestamp,
    snapshot: raw.snapshot,
  };
}

/**
 * POST /api/v1/wishlist
 * Persists a wishlist item to MongoDB.
 */
export async function apiAddToWishlist(payload: AddWishlistPayload): Promise<WishlistItem> {
  const res = await apiRequest<{ success: boolean; data: { item: ApiWishlistItem } }>(
    '/wishlist',
    {
      method: 'POST',
      body: payload as unknown as Record<string, unknown>,
    }
  );
  return mapApiItemToWishlistItem(res.data.item);
}

/**
 * GET /api/v1/wishlist
 * Fetches all wishlist items for the current business, newest first.
 */
export async function apiFetchWishlist(): Promise<WishlistItem[]> {
  const res = await apiRequest<{ success: boolean; data: { items: ApiWishlistItem[] } }>(
    '/wishlist'
  );
  return (res.data?.items ?? []).map(mapApiItemToWishlistItem);
}

/**
 * DELETE /api/v1/wishlist/:itemId
 * Removes a single wishlist item by its client-generated id.
 */
export async function apiDeleteWishlistItem(itemId: string): Promise<void> {
  await apiRequest<{ success: boolean; data: { itemId: string } }>(`/wishlist/${itemId}`, {
    method: 'DELETE',
  });
}

/**
 * DELETE /api/v1/wishlist
 * Clears every wishlist item for the current business.
 */
export async function apiClearWishlist(): Promise<void> {
  await apiRequest<{ success: boolean }>('/wishlist', {
    method: 'DELETE',
  });
}
