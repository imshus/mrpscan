import { create } from 'zustand';

import type { BillableCartPiece } from '@/utils/cartInvoice';
import { registerScopeResetCallback } from '@/utils/userScopedStorage';

interface CartState {
  /** Wishlist item ids, in the order the cart lists them. */
  itemIds: string[];
  /**
   * The pieces as they stood when Generate Invoice was tapped. The invoice
   * screens bill these, not the live wishlist, so a wishlist refresh midway
   * cannot change what the customer details and the preview were shown.
   */
  checkout: BillableCartPiece[] | null;
  /** A new cart from the Wishlist's ticked items; any checkout in progress ends. */
  setItems: (ids: string[]) => void;
  startCheckout: (pieces: BillableCartPiece[]) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  itemIds: [],
  checkout: null,
  setItems: (ids) => set({ itemIds: [...new Set(ids)], checkout: null }),
  startCheckout: (pieces) => set({ checkout: pieces }),
  clear: () => set({ itemIds: [], checkout: null }),
}));

/**
 * The cart is the account's own selection, priced at its own wishlist's
 * figures. It lives in memory, but the app is not restarted between accounts
 * on a shared phone: what one person put in the cart must not be waiting for
 * the next.
 */
registerScopeResetCallback(() => {
  useCartStore.setState(useCartStore.getInitialState(), true);
});
