import type { ScanItemData } from '@/types/scanner';

/**
 * How a scanned piece is identified on screen and on the invoice.
 *
 * The name comes from the shop's own item codes when the tag's number
 * begins with a saved code word; the number is then the tag's whole number,
 * word and running number together. Without a match the number is still
 * the one the tag printed and the name is empty — it used to be composed
 * from the karat and category, and the shop asked for it blank instead,
 * so an unmatched tag is plainly unmatched.
 */
export interface ItemIdentity {
  name: string;
  number: string;
}

export function resolveItemIdentity(scanData: ScanItemData): ItemIdentity {
  return {
    name: scanData.itemName?.trim() || '',
    number: scanData.itemCode?.trim() || scanData.sku?.trim() || '',
  };
}

/** One line pairing the two, for the invoice. Empty when neither is known. */
export function formatItemIdentity(identity: ItemIdentity): string {
  if (identity.name && identity.number) return `${identity.name} · ${identity.number}`;
  return identity.name || identity.number || '';
}
