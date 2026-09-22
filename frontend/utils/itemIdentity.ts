import type { ScanItemData } from '@/types/scanner';
import { resolveScannedKarat } from '@/utils/formulaUtils';

/**
 * How a scanned piece is identified on screen and on the invoice.
 *
 * The name comes from the shop's own item codes when the tag's number
 * begins with a saved code word; the number is then the tag's whole number,
 * word and running number together. Without a match the number is still
 * the one the tag printed and the name is composed from what was scanned,
 * since the tag has no product title of its own.
 */
export interface ItemIdentity {
  name: string;
  number: string;
}

export function resolveItemIdentity(scanData: ScanItemData): ItemIdentity {
  const catalogueName = scanData.itemName?.trim();
  const karat = resolveScannedKarat(scanData.karat, scanData.tunch);
  const category = scanData.category || 'Gold';
  const composed = [karat, category].filter(Boolean).join(' ').trim();

  return {
    name: catalogueName || composed || 'Jewellery',
    number: scanData.itemCode?.trim() || scanData.sku?.trim() || '',
  };
}

/** One line pairing the two, for the invoice. Empty when neither is known. */
export function formatItemIdentity(identity: ItemIdentity): string {
  if (identity.name && identity.number) return `${identity.name} · ${identity.number}`;
  return identity.name || identity.number || '';
}
