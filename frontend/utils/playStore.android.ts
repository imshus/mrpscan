import { Linking } from 'react-native';
import * as InAppUpdates from 'expo-in-app-updates';

import type { PlayUpdate } from '@/utils/appUpdate.types';

/**
 * Google Play, on Android.
 *
 * Metro resolves this file only in an Android build; an iOS build gets
 * playStore.ts, which holds no URL at all. Keep every Play listing URL, the
 * package name and the market:// scheme in here, so the iPhone bundle stays
 * free of them (App Store Review 2.3.10).
 */

/**
 * The Play app is com.amitaashitsolutions. The sideloaded test APK's package
 * has no "s", and Play never reports an update for it.
 */
const PLAY_PACKAGE = 'com.amitaashitsolutions';

const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`;

/**
 * The Play listing with the sender's code and the offer it was shared under
 * riding along as the referrer, in the key=value form Play keeps: invite50
 * for the 50-credit invite, purchase500 for the purchase referral — so each
 * share can be told apart later.
 */
export function playInviteLink(code: string, offer: 'invite50' | 'purchase500'): string {
  return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(`code=${code}&offer=${offer}`)}`;
}

/** The Play Store page, preferring the installed Play app over the browser. */
export async function openPlayListing(): Promise<void> {
  try {
    await Linking.openURL(`market://details?id=${PLAY_PACKAGE}`);
  } catch {
    await Linking.openURL(PLAY_STORE_URL).catch(() => {});
  }
}

/**
 * A newer version on Google Play, or null: none, not installed from Play (a
 * test APK), or offline. Never throws; asking Play costs nothing.
 */
export async function checkPlayUpdate(): Promise<PlayUpdate | null> {
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
  await openPlayListing();
}
