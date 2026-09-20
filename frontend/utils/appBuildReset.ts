import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import { clearPersistedAppState } from './clearAppState';

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

    await clearPersistedAppState();
    await AsyncStorage.setItem(BUILD_KEY, APP_BUILD);
    return true;
  } catch (error) {
    console.warn('Could not check the installed build', error);
    return false;
  }
}
