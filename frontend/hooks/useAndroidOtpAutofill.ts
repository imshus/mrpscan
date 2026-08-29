import { useEffect } from 'react';
import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

interface UseAndroidOtpAutofillOptions {
  enabled?: boolean;
  otpLength?: number;
  onCodeDetected: (otp: string) => void;
  onDetectionError?: (message: string) => void;
}

function extractOtp(message: string, otpLength: number): string | null {
  const regex = new RegExp(`\\b(\\d{${otpLength}})\\b`);
  const match = message.match(regex);
  return match?.[1] ?? null;
}

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

    let removeListener: null | (() => void) = null;

    const start = async () => {
      try {
        const smsModule = NativeModules?.RNSmsRetrieverModule;
        if (!smsModule || typeof smsModule.startSmsRetriever !== 'function') {
          onDetectionError?.('SMS retriever is not available on this build');
          return;
        }

        await smsModule.startSmsRetriever();

        const subscription = DeviceEventEmitter.addListener('me.furtado.smsretriever:SmsEvent', (event: { message?: string }) => {
          const message = event?.message ?? '';
          const otp = extractOtp(message, otpLength);
          if (!otp) return;
          onCodeDetected(otp);
          subscription.remove();
        });

        removeListener = () => {
          subscription.remove();
        };
      } catch (error) {
        onDetectionError?.(error instanceof Error ? error.message : 'Failed to start SMS retriever');
      }
    };

    start();

    return () => {
      if (removeListener) {
        removeListener();
      }
    };
  }, [enabled, onCodeDetected, onDetectionError, otpLength]);
}
