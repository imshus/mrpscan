/**
 * Shared between playStore.ts and playStore.android.ts so both platforms
 * describe an update the same way. Types carry no runtime code, so nothing
 * here reaches either bundle.
 */
export interface PlayUpdate {
  /** The versionCode Play holds, newer than this one. */
  storeVersion: string;
  immediateAllowed: boolean;
  flexibleAllowed: boolean;
  /**
   * Set when the update came from MRPscan's server rather than Google Play
   * (an APK installed directly, which Play never reports to): Update Now
   * opens this download link.
   */
  downloadUrl?: string;
}
