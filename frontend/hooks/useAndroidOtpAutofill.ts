import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { getSmsUserConsent } from '@/modules/sms-user-consent';

interface UseAndroidOtpAutofillOptions {
  enabled?: boolean;
  otpLength?: number;
  onCodeDetected: (otp: string) => void;
  onDetectionError?: (message: string) => void;
}

/**
 * Pulls the OTP out of an SMS body. Prefers the digit run that follows
 * "OTP"/"code" so a template that also carries another number (validity
 * minutes, a support number) cannot win; falls back to the first exact-length
 * run that is not part of a longer number.
 */
export function extractOtp(message: string, otpLength: number): string | null {
  const run = '\\d{' + otpLength + '}';
  const labelled = new RegExp('(?:otp|code)\\D{0,30}?(' + run + ')(?!\\d)', 'i');
  const bare = new RegExp('(?:^|\\D)(' + run + ')(?!\\d)');
  return message.match(labelled)?.[1] ?? message.match(bare)?.[1] ?? null;
}

/**
 * Android auto-read via Google's SMS User Consent API (modules/sms-user-consent):
 * no app hash, no length limit, no SMS permission — Play services shows a one-tap
 * "Allow <app> to read this message" dialog and hands us the body.
 * Listens for up to 5 minutes (API limit) or until unmounted/disabled.
 */
export function useAndroidOtpAutofill({
  enabled = true,
  otpLength = 6,
  onCodeDetected,
  onDetectionError,
}: UseAndroidOtpAutofillOptions): void {
  // Callbacks live in refs so a parent re-render never restarts the listener.
  const detectedRef = useRef(onCodeDetected);
  const errorRef = useRef(onDetectionError);
  detectedRef.current = onCodeDetected;
  errorRef.current = onDetectionError;

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;

    const consent = getSmsUserConsent();
    if (!consent) {
      errorRef.current?.('SMS user consent is not available on this build');
      return;
    }

    let settled = false;
    const received = consent.addListener('onSmsReceived', ({ message }) => {
      if (settled) return;
      const otp = extractOtp(message ?? '', otpLength);
      if (!otp) {
        errorRef.current?.('No ' + otpLength + '-digit code found in the SMS');
        return;
      }
      settled = true;
      detectedRef.current(otp);
    });
    const failed = consent.addListener('onSmsError', ({ error }) => errorRef.current?.(error));

    try {
      consent.startListening();
    } catch (error) {
      errorRef.current?.(error instanceof Error ? error.message : 'Failed to start SMS user consent');
    }

    return () => {
      received.remove();
      failed.remove();
      try { consent.stopListening(); } catch { /* already stopped */ }
    };
  }, [enabled, otpLength]);
}
