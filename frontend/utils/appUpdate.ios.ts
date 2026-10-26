import type { PlayUpdate } from './appUpdate';

export type { PlayUpdate };

/**
 * The iPhone build of utils/appUpdate (Metro picks this file on iOS).
 *
 * Update Now is a Google Play feature, and expo-in-app-updates is left out of
 * the iOS build (package.json expo.autolinking.ios.exclude): its iOS pod needs
 * iOS 16.4, above Expo SDK 54's 15.1 minimum, and pod install fails on it.
 * Importing that package here would throw at launch, since its native module
 * is not in the build, so this file never imports it.
 */
export async function checkPlayUpdate(): Promise<PlayUpdate | null> {
  return null;
}

export async function startPlayUpdate(_update: PlayUpdate): Promise<void> {
  // Never called: checkPlayUpdate never offers an update on iOS.
}
