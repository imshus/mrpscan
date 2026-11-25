import Constants from 'expo-constants';
import { Linking } from 'react-native';

/**
 * The App Store, on iPhone (Metro resolves this file only in an iOS build;
 * appStore.ts is the empty copy for Android).
 *
 * Apple's public lookup (itunes.apple.com/lookup) says which version the App
 * Store holds for this bundle ID in India. Its answer can lag a release by a
 * few hours; it needs no key and costs nothing.
 */

export type AppStoreUpdate = { storeVersion: string; storeUrl: string };

const BUNDLE_ID = Constants.expoConfig?.ios?.bundleIdentifier || 'com.amitaashitsolution';

/** 1.0.390 > 1.0.389, part by part; missing parts count as 0. */
export function isNewerVersion(store: string, running: string): boolean {
  const a = store.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const b = running.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/**
 * A newer version on the App Store, or null: none, not listed yet, or
 * offline. Never throws.
 */
export async function checkAppStoreUpdate(): Promise<AppStoreUpdate | null> {
  const running = String(Constants.expoConfig?.version ?? '');
  if (!running) return null;
  try {
    const response = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(BUNDLE_ID)}&country=in&t=${Date.now()}`,
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { results?: { version?: string; trackViewUrl?: string; trackId?: number }[] };
    const app = body.results?.[0];
    const storeVersion = String(app?.version ?? '');
    if (!storeVersion || !isNewerVersion(storeVersion, running)) return null;
    const storeUrl = app?.trackId
      ? `itms-apps://apps.apple.com/app/id${app.trackId}`
      : String(app?.trackViewUrl ?? '');
    return { storeVersion, storeUrl };
  } catch {
    return null;
  }
}

/** Update Now: MRPscan's own App Store page. */
export async function openAppStoreUpdate(update: AppStoreUpdate): Promise<void> {
  if (!update.storeUrl) return;
  await Linking.openURL(update.storeUrl).catch(() => {});
}
