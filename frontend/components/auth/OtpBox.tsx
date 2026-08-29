import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Colors } from '@/constants/theme';

const OTP_LENGTH = 6;

interface OtpBoxProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when the user taps "Resend code"; the countdown restarts automatically. */
  onResend?: () => void;
  resendLoading?: boolean;
  label?: string;
  autoFocus?: boolean;
  /** Resend countdown in seconds (mockup default 30). */
  seconds?: number;
}

/**
 * 6-digit OTP entry ported from the mockup's `.otp-box`:
 * dashed cream card, square digit cells, "Resend code in 0:30" countdown.
 * A single invisible input overlays the cells so SMS autofill keeps working.
 */
export function OtpBox({
  value,
  onChange,
  onResend,
  resendLoading,
  label = 'Enter the 6-digit code sent to your phone',
  autoFocus = true,
  seconds = 30,
}: OtpBoxProps) {
  const inputRef = useRef<TextInput>(null);
  const [remaining, setRemaining] = useState(seconds);
  const [focused, setFocused] = useState(false);
  const [autofillMsg, setAutofillMsg] = useState<string | null>(null);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  const digits = value.padEnd(OTP_LENGTH, ' ').split('').slice(0, OTP_LENGTH);
  const activeIndex = Math.min(value.length, OTP_LENGTH - 1);

  const timerLabel = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  const handleResend = () => {
    if (resendLoading) return;
    onResend?.();
    setRemaining(seconds);
    inputRef.current?.focus();
  };

  // Fill the code from the clipboard (e.g. after "Copy" on the SMS notification).
  const handleAutofill = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      const match = (text || '').match(new RegExp(`\\b(\\d{${OTP_LENGTH}})\\b`));
      if (match) {
        setAutofillMsg(null);
        onChange(match[1]);
        return;
      }
      setAutofillMsg('No code found — copy the OTP SMS, then tap Autofill.');
    } catch {
      setAutofillMsg('Could not read the clipboard.');
    }
    inputRef.current?.focus();
  };

  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.digitsWrap}>
        <View style={styles.digitsRow} pointerEvents="none">
          {digits.map((digit, index) => {
            const filled = digit.trim() !== '';
            const isActive = focused && index === activeIndex && value.length < OTP_LENGTH;
            return (
              <View
                key={index}
                style={[
                  styles.digitCell,
                  filled && styles.digitCellFilled,
                  isActive && styles.digitCellActive,
                ]}
              >
                <Text style={styles.digitText}>{filled ? digit : ''}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, OTP_LENGTH))}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          style={styles.overlayInput}
          caretHidden
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          textContentType="oneTimeCode"
          importantForAutofill="yes"
        />
      </View>

      <View style={styles.metaRow}>
        {remaining > 0 ? (
          <Text style={styles.metaText}>
            Resend code in <Text style={styles.metaTimer}>{timerLabel}</Text>
          </Text>
        ) : (
          <Pressable onPress={handleResend} disabled={resendLoading} hitSlop={6}>
            <Text style={styles.resendLink}>{resendLoading ? 'Sending…' : 'Resend code'}</Text>
          </Pressable>
        )}
        <Pressable onPress={handleAutofill} hitSlop={6}>
          <Text style={styles.resendLink}>Autofill</Text>
        </Pressable>
      </View>
      {autofillMsg ? <Text style={styles.metaText}>{autofillMsg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 8,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  digitsWrap: {
    position: 'relative',
  },
  digitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  digitCell: {
    flex: 1,
    maxWidth: 44,
    aspectRatio: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitCellFilled: {
    borderColor: 'rgba(21,18,13,0.3)',
  },
  digitCellActive: {
    borderColor: Colors.brand,
  },
  digitText: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  overlayInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.01,
    color: 'transparent',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  metaTimer: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  resendLink: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.brandDeep,
  },
});
