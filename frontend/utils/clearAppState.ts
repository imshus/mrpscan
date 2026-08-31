import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Every persisted store key in the app.
 *
 * Signing out has to clear all of them: they hold one business's data, and
 * whatever survives is silently inherited by the next account signed in on the
 * device — its name, GSTIN, employees, inventory and wishlist.
 */
export const PERSISTED_STORE_KEYS = [
  'pratham-auth',
  'pratham-employees',
  'pratham-inventory',
  'pratham-purity',
  'pratham-wishlist',
] as const;

/**
 * Wipes every persisted store. Call when signing out, or before starting a
 * fresh signup, so nothing from the previous account carries over.
 *
 * Failures are swallowed deliberately: a device that cannot clear storage must
 * still be able to sign out.
 */
export async function clearPersistedAppState(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...PERSISTED_STORE_KEYS]);
  } catch (error) {
    console.warn('Could not clear persisted app state', error);
  }
}
