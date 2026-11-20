/**
 * The update popup, on every platform that is not Android — which is the
 * iPhone, where it renders nothing.
 *
 * Updating through Google Play is an Android concern, and an iOS app may not
 * name another platform's store (App Store Review 2.3.10). Metro resolves
 * AppUpdatePopup.android.tsx in an Android build and this file in an iOS one,
 * so neither the Play copy nor the Play URLs behind it are bundled for iPhone.
 * The App Store updates an iOS app on its own.
 */
export function AppUpdatePopup(_props: { enabled: boolean }) {
  return null;
}
