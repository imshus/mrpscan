/**
 * Yellow dev OTP banner — OFF by default in APK and production.
 * Real users receive OTP via SMS (phone); they type it in the boxes.
 * Set EXPO_PUBLIC_SHOW_DEV_OTP=true only on your machine when testing without SMS.
 */
export function isDevOtpBannerEnabled(): boolean {
  return process.env.EXPO_PUBLIC_SHOW_DEV_OTP === 'true';
}
