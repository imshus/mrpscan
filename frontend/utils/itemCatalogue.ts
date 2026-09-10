import { useEffect, useState } from 'react';

import { fetchItemCodes, type ItemCode } from '@/utils/itemCodeApi';
import { registerScopeResetCallback } from '@/utils/userScopedStorage';

/**
 * The shop's saved item codes (Masters → Item Code), held in memory so the
 * review card can list them and name a scanned tag without a round trip.
 *
 * Loaded once per account and reused; the Masters sheet invalidates it when
 * it saves or deletes a line, and an account switch drops it altogether.
 */
let catalogue: ItemCode[] | null = null;
let inFlight: Promise<ItemCode[]> | null = null;
const listeners = new Set<() => void>();

registerScopeResetCallback(() => {
  catalogue = null;
  inFlight = null;
  notify();
});

function notify() {
  for (const listener of listeners) listener();
}

/** Resolves to the saved codes; a failed load resolves to what is cached (or nothing). */
export function loadItemCatalogue(force = false): Promise<ItemCode[]> {
  if (catalogue && !force) return Promise.resolve(catalogue);
  if (inFlight) return inFlight;
  const request = fetchItemCodes()
    .then((items) => {
      catalogue = items;
      notify();
      return items;
    })
    .catch(() => catalogue ?? [])
    .finally(() => {
      if (inFlight === request) inFlight = null;
    });
  inFlight = request;
  return request;
}

export function invalidateItemCatalogue(): void {
  catalogue = null;
  inFlight = null;
}

export function getCachedItemCatalogue(): ItemCode[] {
  return catalogue ?? [];
}

/** Tags print codes with stray spaces, dashes and case; compare on the characters alone. */
function codeKey(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * The saved item whose code is the one printed on the tag — exact first,
 * then ignoring spacing and punctuation. Null when the code is unknown.
 */
export function findItemByCode(code: string, items: ItemCode[] = getCachedItemCatalogue()): ItemCode | null {
  const wanted = code.trim().toUpperCase();
  if (!wanted) return null;
  const exact = items.find((item) => item.code.toUpperCase() === wanted);
  if (exact) return exact;
  const key = codeKey(wanted);
  if (!key) return null;
  return items.find((item) => codeKey(item.code) === key) ?? null;
}

/** The catalogue name for a tag's code, or empty when the code is not saved. */
export function itemNameForCode(code: string, items?: ItemCode[]): string {
  return findItemByCode(code, items)?.description ?? '';
}

/** The saved codes for a screen, loading them on first use and following later changes. */
export function useItemCatalogue(): { items: ItemCode[]; loading: boolean } {
  const [items, setItems] = useState<ItemCode[]>(getCachedItemCatalogue);
  const [loading, setLoading] = useState(catalogue === null);

  useEffect(() => {
    let active = true;
    const listener = () => {
      if (active) setItems(getCachedItemCatalogue());
    };
    listeners.add(listener);
    void loadItemCatalogue().then((loaded) => {
      if (!active) return;
      setItems(loaded);
      setLoading(false);
    });
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);

  return { items, loading };
}
