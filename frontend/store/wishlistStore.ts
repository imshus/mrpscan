import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { WishlistItem } from '@/types/wishlist';
import {
  apiAddToWishlist,
  apiClearWishlist,
  apiDeleteWishlistItem,
  apiFetchWishlist,
} from '@/utils/wishlistApi';

interface WishlistState {
  items: WishlistItem[];
  isLoading: boolean;
  addItem: (item: WishlistItem) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  getItemById: (id: string) => WishlistItem | undefined;
  /** Returns true if a wishlist entry with the same tagCode already exists. */
  isInWishlist: (tagCode: string) => boolean;
  /** Fetches items from the backend and replaces local state. */
  syncFromApi: () => Promise<void>;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,

      addItem: async (item) => {
        // Optimistic update first so the UI is instant
        set((state) => ({ items: [item, ...state.items] }));
        try {
          await apiAddToWishlist({
            itemId: item.id,
            title: item.title,
            tagCode: item.tagCode,
            totalMrp: item.totalMrp,
            priceBadge: item.priceBadge,
            calculationRate: item.calculationRate,
            scanTimestamp: item.scanTimestamp,
            snapshot: item.snapshot,
          });
        } catch {
          // Roll back on failure
          set((state) => ({ items: state.items.filter((i) => i.id !== item.id) }));
          throw new Error('Failed to save item to wishlist. Please try again.');
        }
      },

      removeItem: async (id) => {
        const previous = get().items;
        // Optimistic update
        set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
        try {
          await apiDeleteWishlistItem(id);
        } catch {
          // Roll back
          set({ items: previous });
          throw new Error('Failed to remove item. Please try again.');
        }
      },

      clearAll: async () => {
        const previous = get().items;
        set({ items: [] });
        try {
          await apiClearWishlist();
        } catch {
          set({ items: previous });
          throw new Error('Failed to clear wishlist. Please try again.');
        }
      },

      getItemById: (id) => get().items.find((item) => item.id === id),

      isInWishlist: (tagCode) =>
        get().items.some((item) => item.tagCode === tagCode),

      syncFromApi: async () => {
        set({ isLoading: true });
        try {
          const items = await apiFetchWishlist();
          set({ items });
        } catch {
          // Keep existing cached items on failure — network might be offline
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'pratham-wishlist',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

