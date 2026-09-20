import AsyncStorage from '@react-native-async-storage/async-storage';

/** Every key this app writes starts with this. */
export const APP_STORAGE_PREFIX = 'pratham-';

/**
 * The sign-in number this device remembers, kept OUTSIDE the stores so a new
 * build's wipe leaves it standing: the wipe exists to stop one build
 * inheriting another's cached data, and a phone number typed by the owner is
 * not cache — losing it just made every update re-ask who the shop is.
 */
export const REMEMBERED_PHONE_KEY = 'pratham-remembered-phone';

/** Keys the build wipe deliberately leaves alone. */
const SPARED_KEYS = new Set<string>([REMEMBERED_PHONE_KEY]);

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
    const ours = keys.filter((key) => key.startsWith(APP_STORAGE_PREFIX) && !SPARED_KEYS.has(key));
    if (ours.length > 0) {
      await AsyncStorage.multiRemove(ours);
    }
  } catch (error) {
    console.warn('Could not clear persisted app state', error);
  }
}
