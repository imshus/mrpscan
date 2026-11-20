import type { PlayUpdate } from '@/utils/appUpdate.types';

/**
 * Google Play, for every platform that is not Android — which means the
 * iPhone, and which means nothing at all.
 *
 * Metro resolves playStore.android.ts in an Android build and this file in an
 * iOS one, so the Play listing URL, the Play package name and the market://
 * scheme are not merely unreachable on iPhone: they are never bundled. An iOS
 * app may not point people at another platform's store (App Store Review
 * 2.3.10), and the cleanest way to honour that is for the string not to exist.
 *
 * Every export here matches playStore.android.ts, so callers need no platform
 * check of their own. This file must never import expo-in-app-updates: that
 * package is excluded from the iOS build (package.json expo.autolinking.ios
 * .exclude) because its pod needs iOS 16.4, above Expo SDK 54's 15.1 minimum,
 * so importing it would throw at launch with the native module absent.
 */

/** No invite URL on iPhone; the referral code alone is what the new shop types in. */
export function playInviteLink(_code: string, _offer: 'invite50' | 'purchase500'): string {
  return '';
}

/** Nothing to open: there is no Play listing to send an iPhone to. */
export async function openPlayListing(): Promise<void> {
  // Intentionally empty.
}

/** Play never reports an update to a non-Android build. */
export async function checkPlayUpdate(): Promise<PlayUpdate | null> {
  return null;
}

/** Unreachable without an update, and an update never arrives here. */
export async function startPlayUpdate(_update: PlayUpdate): Promise<void> {
  // Intentionally empty.
}
