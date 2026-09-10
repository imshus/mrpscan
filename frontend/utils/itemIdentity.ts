import type { ScanItemData } from '@/types/scanner';
import { resolveScannedKarat } from '@/utils/formulaUtils';

/**
 * How a scanned piece is identified on screen and on the invoice.
 *
 * The tag carries the number. The name is the catalogue's, when the number
 * matches a saved item code; otherwise it is composed from what was scanned,
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
    number: scanData.sku?.trim() || '',
  };
}

/** One line pairing the two, for the invoice. Empty when neither is known. */
export function formatItemIdentity(identity: ItemIdentity): string {
  if (identity.name && identity.number) return `${identity.name} · ${identity.number}`;
  return identity.name || identity.number || '';
}
