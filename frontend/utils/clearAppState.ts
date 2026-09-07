import AsyncStorage from '@react-native-async-storage/async-storage';

/** Every key this app writes starts with this. */
export const APP_STORAGE_PREFIX = 'pratham-';

/**
 * The persisted store names. Each is stored under one key per account
 * (see `utils/userScopedStorage.ts`), except the session itself.
 */
export const PERSISTED_STORE_KEYS = [
  'pratham-auth',
  'pratham-employees',
  'pratham-inventory',
  'pratham-purity',
  'pratham-wishlist',
] as const;

/**
 * Wipes everything this app has stored on the phone, for every account.
 * Used when a new build is installed over an old one. Signing out no longer
 * calls this: each account's data lives under its own keys and is simply
 * left alone for the next time that account signs in.
 *
 * Failures are swallowed deliberately: a device that cannot clear storage must
 * still be able to start.
 */
export async function clearPersistedAppState(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((key) => key.startsWith(APP_STORAGE_PREFIX));
    if (ours.length > 0) {
      await AsyncStorage.multiRemove(ours);
    }
  } catch (error) {
    console.warn('Could not clear persisted app state', error);
  }
}
