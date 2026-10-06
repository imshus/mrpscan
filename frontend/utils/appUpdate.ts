import { Linking, Platform } from 'react-native';
import * as InAppUpdates from 'expo-in-app-updates';

/**
 * The Play Store listing, for Update Now when Google Play's own update screen
 * cannot start. Only an app installed from Play ever gets this far, and the
 * Play app is com.amitaashitsolutions (the sideloaded test APK's package has
 * no "s" and Play never reports an update for it).
 */
const PLAY_PACKAGE = 'com.amitaashitsolutions';

export interface PlayUpdate {
  /** The versionCode Play holds, newer than this one. */
  storeVersion: string;
  immediateAllowed: boolean;
  flexibleAllowed: boolean;
}

/**
 * A newer version on Google Play, or null: none, not installed from Play (a
 * test APK), offline, or not Android. Never throws; asking Play costs nothing.
 */
export async function checkPlayUpdate(): Promise<PlayUpdate | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const result = await InAppUpdates.checkForUpdate();
    if (!result.updateAvailable && !result.updateInProgress) return null;
    return {
      storeVersion: String(result.storeVersion ?? ''),
      immediateAllowed: Boolean(result.immediateAllowed),
      flexibleAllowed: Boolean(result.flexibleAllowed),
    };
  } catch {
    return null;
  }
}

/**
 * Update Now: Google Play's own update screen, which downloads the new
 * version and restarts into it. When Play will not start it, the Play Store
 * page opens instead.
 */
export async function startPlayUpdate(update: PlayUpdate): Promise<void> {
  try {
    if (update.immediateAllowed || update.flexibleAllowed) {
      const started = await InAppUpdates.startUpdate(update.immediateAllowed);
      if (started) return;
    }
  } catch {
    // Falls through to the store page.
  }
  try {
    await Linking.openURL(`market://details?id=${PLAY_PACKAGE}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`).catch(() => {});
  }
}
