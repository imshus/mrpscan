import type { ScanItemData } from '@/types/scanner';

/**
 * How a scanned piece is identified on screen and on the invoice.
 *
 * Only what Masters -> Item Code gives, at the shop's asking: when one of
 * the tag's numbers matches a saved code, the name is that row's and the
 * number is the code as the tag printed it. Without a match both are empty
 * — the raw number off the tag is not shown in its place.
 */
export interface ItemIdentity {
  name: string;
  number: string;
}

export function resolveItemIdentity(scanData: ScanItemData): ItemIdentity {
  return {
    name: scanData.itemName?.trim() || '',
    number: scanData.itemCode?.trim() || '',
  };
}

/** One line pairing the two, for the invoice. Empty when neither is known. */
export function formatItemIdentity(identity: ItemIdentity): string {
  if (identity.name && identity.number) return `${identity.name} · ${identity.number}`;
  return identity.name || identity.number || '';
}
