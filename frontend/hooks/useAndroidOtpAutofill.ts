import { useEffect } from 'react';
import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

import { getSmsUserConsent } from '@/modules/sms-user-consent';

interface UseAndroidOtpAutofillOptions {
  enabled?: boolean;
  otpLength?: number;
  onCodeDetected: (otp: string) => void;
  onDetectionError?: (message: string) => void;
}

function extractOtp(message: string, otpLength: number): string | null {
  const regex = new RegExp(`\b(\d{${otpLength}})\b`);
  const match = message.match(regex);
  return match?.[1] ?? null;
}

/**
 * Reads the incoming OTP SMS on Android using two complementary Google APIs:
 *
 * 1. SMS Retriever — fully automatic, but only delivers messages that are
 *    <=140 bytes AND end with this app's 11-character hash. Our DLT-approved
 *    template is 147 characters, so this path stays dormant until the template
 *    is shortened and the hash appended.
 * 2. SMS User Consent — no hash and no length limit; the user taps once on a
 *    system dialog. This is the path that works with the current template.
 *
 * Whichever delivers the code first wins; both are torn down afterwards.
 */
export function useAndroidOtpAutofill({
  enabled = true,
  otpLength = 6,
  onCodeDetected,
  onDetectionError,
}: UseAndroidOtpAutofillOptions): void {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') {
      return;
    }

    let settled = false;
    const cleanups: Array<() => void> = [];

    const deliver = (message: string) => {
      if (settled) return;
      const otp = extractOtp(message, otpLength);
      if (!otp) return;
      settled = true;
      onCodeDetected(otp);
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    };

    // --- 1. SMS Retriever (zero-tap, needs the app hash in the message) ---
    const startRetriever = async () => {
      try {
        const smsModule = NativeModules?.RNSmsRetrieverModule;
        if (!smsModule || typeof smsModule.startSmsRetriever !== 'function') {
          return;
        }

        await smsModule.startSmsRetriever();

        const subscription = DeviceEventEmitter.addListener(
          'me.furtado.smsretriever:SmsEvent',
          (event: { message?: string }) => deliver(event?.message ?? ''),
        );
        cleanups.push(() => subscription.remove());
      } catch (error) {
        onDetectionError?.(
          error instanceof Error ? error.message : 'Failed to start SMS retriever',
        );
      }
    };

    // --- 2. SMS User Consent (one tap, works with any template) ---
    const startUserConsent = () => {
      const consent = getSmsUserConsent();
      if (!consent) {
        onDetectionError?.('SMS user consent is not available on this build');
        return;
      }

      try {
        const received = consent.addListener('onSmsReceived', ({ message }) => deliver(message));
        const failed = consent.addListener('onSmsError', ({ error }) => onDetectionError?.(error));
        consent.startListening();

        cleanups.push(() => {
          received.remove();
          failed.remove();
          consent.stopListening();
        });
      } catch (error) {
        onDetectionError?.(
          error instanceof Error ? error.message : 'Failed to start SMS user consent',
        );
      }
    };

    void startRetriever();
    startUserConsent();

    return () => {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    };
  }, [enabled, onCodeDetected, onDetectionError, otpLength]);
}
