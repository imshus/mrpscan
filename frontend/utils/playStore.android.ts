import Constants from 'expo-constants';
import { Linking } from 'react-native';
import * as InAppUpdates from 'expo-in-app-updates';

import { API_BASE_URL } from '@/constants/api';
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
 * The newest release MRPscan's server knows of (GET /app-config `android`,
 * set from the server's .env on each release), when its versionCode is above
 * this build's. For phones whose APK did not come from Google Play.
 */
async function checkServerUpdate(): Promise<PlayUpdate | null> {
  const running = Number(Constants.expoConfig?.android?.versionCode ?? 0);
  if (!running) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/app-config?t=${Date.now()}`);
    if (!response.ok) return null;
    const body = (await response.json()) as {
      data?: { android?: { latestVersion?: string; latestVersionCode?: number; downloadUrl?: string } };
    };
    const latest = body.data?.android;
    const latestCode = Number(latest?.latestVersionCode ?? 0);
    if (!(latestCode > running)) return null;
    return {
      storeVersion: String(latest?.latestVersion || latestCode),
      immediateAllowed: false,
      flexibleAllowed: false,
      downloadUrl: String(latest?.downloadUrl ?? '').trim() || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * A newer version, or null: none, or offline. Google Play first; when Play
 * has nothing to say (always so for an APK installed directly), MRPscan's
 * server. Never throws.
 */
export async function checkPlayUpdate(): Promise<PlayUpdate | null> {
  try {
    const result = await InAppUpdates.checkForUpdate();
    if (result.updateAvailable || result.updateInProgress) {
      return {
        storeVersion: String(result.storeVersion ?? ''),
        immediateAllowed: Boolean(result.immediateAllowed),
        flexibleAllowed: Boolean(result.flexibleAllowed),
      };
    }
  } catch {
    // Not from Play, or Play unreachable: ask the server below.
  }
  return checkServerUpdate();
}

/**
 * Update Now: Google Play's own update screen, which downloads the new
 * version and restarts into it. When Play will not start it, the Play Store
 * page opens instead.
 */
export async function startPlayUpdate(update: PlayUpdate): Promise<void> {
  // From MRPscan's server: its own download link (the APK was not from Play).
  if (update.downloadUrl) {
    await Linking.openURL(update.downloadUrl).catch(() => {});
    return;
  }
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
