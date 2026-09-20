import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { clearPersistedAppState, REMEMBERED_PHONE_KEY } from './clearAppState';

/**
 * Pulls the remembered sign-in number out of the auth store before the wipe
 * removes it. Builds older than the spared key kept the number only inside
 * the store, so without this one rescue the first upgrade still forgot it.
 */
async function preserveRememberedPhone(): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(REMEMBERED_PHONE_KEY);
    if (existing) return;
    const rawAuth = await AsyncStorage.getItem('pratham-auth');
    if (!rawAuth) return;
    const phone = String(JSON.parse(rawAuth)?.state?.savedPhone ?? '').replace(/\D/g, '').slice(-10);
    if (phone.length === 10) await AsyncStorage.setItem(REMEMBERED_PHONE_KEY, phone);
  } catch {
    // The number is a convenience; a failed rescue must not block the start.
  }
}

/** Where the build that last wrote this device's data is recorded. */
const BUILD_KEY = 'pratham-build';

/**
 * The build this install belongs to.
 *
 * Installing a new APK over an existing one keeps the app's stored data, so
 * everything the previous version cached — session, employees, inventory,
 * purity, wishlist — would otherwise be inherited by the new build.
 */
export const APP_BUILD = String(Constants.expoConfig?.version ?? 'dev');

/**
 * Clears every persisted store when the installed build has changed.
 *
 * Returns true when a wipe happened, so the caller knows the in-memory stores
 * are now stale and must be rehydrated.
 *
 * Failures are swallowed the way `clearPersistedAppState` swallows them: a
 * device that cannot read storage must still start. In that case this returns
 * false — leaving the existing data alone is better than wiping blindly on an
 * unknown storage state.
 */
export async function resetIfNewBuild(): Promise<boolean> {
  try {
    const storedBuild = await AsyncStorage.getItem(BUILD_KEY);
    if (storedBuild === APP_BUILD) {
      return false;
    }

    await preserveRememberedPhone();
    await clearPersistedAppState();
    await AsyncStorage.setItem(BUILD_KEY, APP_BUILD);
    return true;
  } catch (error) {
    console.warn('Could not check the installed build', error);
    return false;
  }
}
