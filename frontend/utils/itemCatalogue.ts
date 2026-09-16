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
/** Bumped whenever the cache is dropped, so a load begun before then cannot refill it. */
let generation = 0;

registerScopeResetCallback(() => {
  invalidateItemCatalogue();
  notify();
});

function notify() {
  for (const listener of listeners) listener();
}

/** Resolves to the saved codes; a failed load resolves to what is cached (or nothing). */
export function loadItemCatalogue(force = false): Promise<ItemCode[]> {
  if (catalogue && !force) return Promise.resolve(catalogue);
  if (inFlight) return inFlight;
  const issuedAt = generation;
  const request = fetchItemCodes()
    .then((items) => {
      // Dropped while loading (an account switch, a save): this list belongs
      // to whoever asked for it then, not to the cache as it is now.
      if (issuedAt !== generation) return [];
      catalogue = items;
      notify();
      return items;
    })
    .catch(() => (issuedAt === generation ? catalogue ?? [] : []))
    .finally(() => {
      if (inFlight === request) inFlight = null;
    });
  inFlight = request;
  return request;
}

export function invalidateItemCatalogue(): void {
  catalogue = null;
  inFlight = null;
  generation += 1;
}

export function getCachedItemCatalogue(): ItemCode[] {
  return catalogue ?? [];
}

/** Tags print codes with stray spaces, dashes and case; compare on the characters alone. */
function codeKey(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * The saved item whose code the tag is printed with — exact first, then
 * ignoring spacing and punctuation, then as the start of the tag's number.
 *
 * Tags rarely print the item code alone: a ring coded GR is tagged GR10286,
 * the code followed by that piece's running number. So a saved code that
 * begins the tag's number identifies the item, as long as what follows is
 * digits — otherwise GRT500 would answer to a shop's GR. The longest such
 * code wins, so GRT is preferred over GR by a shop that saved both.
 *
 * Null when nothing saved matches.
 */
export function findItemByCode(code: string, items: ItemCode[] = getCachedItemCatalogue()): ItemCode | null {
  const wanted = code.trim().toUpperCase();
  if (!wanted) return null;
  const exact = items.find((item) => item.code.toUpperCase() === wanted);
  if (exact) return exact;
  const key = codeKey(wanted);
  if (!key) return null;
  const sameKey = items.find((item) => codeKey(item.code) === key);
  if (sameKey) return sameKey;

  let prefixed: ItemCode | null = null;
  let prefixLength = 0;
  for (const item of items) {
    const itemKey = codeKey(item.code);
    // One character is too little to identify an item: half the tags in a
    // shop would answer to it.
    if (itemKey.length < 2 || itemKey.length >= key.length) continue;
    if (!key.startsWith(itemKey)) continue;
    if (!/^[0-9]/.test(key.slice(itemKey.length))) continue;
    if (itemKey.length > prefixLength) {
      prefixed = item;
      prefixLength = itemKey.length;
    }
  }
  return prefixed;
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
      if (!active) return;
      setItems(getCachedItemCatalogue());
      // Dropped underneath a mounted picker: show it loading, not empty.
      setLoading(catalogue === null);
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
