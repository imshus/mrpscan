import { create } from 'zustand';

import { endCheckoutState, type BillableCartPiece, type BilledCheckout } from '@/utils/cartInvoice';
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
  /**
   * The checkout is one wishlist item billed from its own result screen, not
   * the cart: billing it must leave the cart's tags where they are.
   */
  singleItem: boolean;
  /** A new cart from the Wishlist's ticked items; any checkout in progress ends. */
  setItems: (ids: string[]) => void;
  startCheckout: (pieces: BillableCartPiece[], options?: { singleItem?: boolean }) => void;
  /**
   * An invoice is generated: what it billed cannot be billed again. A cart's
   * invoice empties that cart (the wishlist keeps its items) unless another
   * has been built since; one item billed alone leaves the cart as it was.
   * Only the checkout it billed ends: one started while its request was out
   * stays open.
   */
  endCheckout: (billed: BilledCheckout) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  itemIds: [],
  checkout: null,
  singleItem: false,
  setItems: (ids) => set({ itemIds: [...new Set(ids)], checkout: null, singleItem: false }),
  startCheckout: (pieces, options) => set({ checkout: pieces, singleItem: options?.singleItem === true }),
  endCheckout: (billed) => set((state) => endCheckoutState(state, billed)),
  clear: () => set({ itemIds: [], checkout: null, singleItem: false }),
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
