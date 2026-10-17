import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { useCartStore } from '@/store/cartStore';
import { buildCartInvoice, type CartInvoice } from '@/utils/cartInvoice';

/** The route param the cart's Generate Invoice opens the invoice screens with. */
export const CART_INVOICE_SOURCE = 'cart';

/**
 * Whether the invoice screens were opened from the cart, and if so the one
 * invoice for its pieces. Opened from a scan result (no `source`), it is
 * { isCart: false, invoice: null } and the screens bill that scan as always.
 *
 * Opened from the cart with nothing checked out (the account changed
 * meanwhile), `invoice` is null and the screens refuse to bill, rather than
 * falling back to whatever scan the scanner last held.
 */
export function useCartInvoice(): { isCart: boolean; invoice: CartInvoice | null } {
  const { source } = useLocalSearchParams<{ source?: string }>();
  const isCart = source === CART_INVOICE_SOURCE;
  const checkout = useCartStore((state) => state.checkout);
  const invoice = useMemo(
    () => (isCart && checkout && checkout.length > 0 ? buildCartInvoice(checkout) : null),
    [isCart, checkout],
  );
  return { isCart, invoice };
}
