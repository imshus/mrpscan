import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

import { useAuthStore } from '@/store/authStore';

/**
 * Per-user storage for the persisted stores.
 *
 * Wishlist, employees, inventory and purity used to live under one key each,
 * so signing out had to wipe them or the next account signed in on the phone
 * would inherit them. Each key is now suffixed with the account that wrote
 * it; switching accounts simply reads a different set of keys, and what a
 * person had is still there when they sign back in.
 *
 * The suffix is the role plus the account's phone number (or its login ID
 * when no number is known), so the owner and an employee sharing a phone
 * still keep separate data. Before anyone has signed in it is "anonymous".
 */

/** The account the persisted stores belong to right now. */
export function currentUserScope(): string {
  const { userRole, registration } = useAuthStore.getState();
  if (!userRole) return 'anonymous';
  const phone = String(registration?.phone ?? '').replace(/\D/g, '').slice(-10);
  const loginId = String(registration?.userId ?? '').trim().toLowerCase();
  const who = phone || loginId;
  return who ? `${userRole}:${who}` : 'anonymous';
}

/** The storage key for `name` under the current account. */
export function scopedKey(name: string, scope: string = currentUserScope()): string {
  return `${name}@${scope}`;
}

export const userScopedStorage: StateStorage = {
  getItem: (name) => AsyncStorage.getItem(scopedKey(name)),
  setItem: (name, value) => AsyncStorage.setItem(scopedKey(name), value),
  removeItem: (name) => AsyncStorage.removeItem(scopedKey(name)),
};

interface ScopedStore {
  setState: (state: never, replace: true) => void;
  getInitialState: () => unknown;
  persist: { rehydrate: () => Promise<void> | void };
}

const scopedStores: ScopedStore[] = [];

/** Stores registered here are reloaded whenever the signed-in account changes. */
export function registerUserScopedStore(store: unknown): void {
  scopedStores.push(store as ScopedStore);
}

/**
 * Reloads every user-scoped store from the current account's keys. Each
 * store is first reset to its code defaults: zustand's rehydrate merges over
 * whatever is in memory, so without the reset an absent key would leave the
 * previous account's data on screen.
 */
export async function rehydrateUserScopedStores(): Promise<void> {
  for (const store of scopedStores) {
    store.setState(store.getInitialState() as never, true);
  }
  await Promise.all(scopedStores.map((store) => store.persist.rehydrate()));
}

let activeScope = currentUserScope();
useAuthStore.subscribe(() => {
  const next = currentUserScope();
  if (next === activeScope) return;
  activeScope = next;
  void rehydrateUserScopedStores();
});
