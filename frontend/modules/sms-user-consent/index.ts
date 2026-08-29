import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import type { EventSubscription } from 'expo-modules-core';

interface SmsUserConsentModule {
  startListening(): void;
  stopListening(): void;
  addListener(
    event: 'onSmsReceived',
    listener: (payload: { message: string }) => void,
  ): EventSubscription;
  addListener(
    event: 'onSmsError',
    listener: (payload: { error: string }) => void,
  ): EventSubscription;
}

/**
 * Android SMS User Consent API. Returns null off Android or when the native
 * module is missing (e.g. an older build), so callers can degrade gracefully.
 */
export function getSmsUserConsent(): SmsUserConsentModule | null {
  if (Platform.OS !== 'android') return null;
  try {
    return requireNativeModule<SmsUserConsentModule>('SmsUserConsent');
  } catch {
    return null;
  }
}
