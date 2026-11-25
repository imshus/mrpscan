/**
 * The App Store, for every platform that is not iOS — which is Android, where
 * updates come from Google Play (utils/playStore.android.ts) and this is
 * empty. Metro resolves appStore.ios.ts in an iPhone build.
 */

export type AppStoreUpdate = { storeVersion: string; storeUrl: string };

export function isNewerVersion(_store: string, _running: string): boolean {
  return false;
}

export async function checkAppStoreUpdate(): Promise<AppStoreUpdate | null> {
  return null;
}

export async function openAppStoreUpdate(_update: AppStoreUpdate): Promise<void> {
  // Intentionally empty.
}
