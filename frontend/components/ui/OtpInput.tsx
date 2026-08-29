import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { ErrorText } from './ErrorText';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

const OTP_LENGTH = 6;

export function OtpInput({ value, onChange, error }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const digits = value.padEnd(OTP_LENGTH, ' ').split('').slice(0, OTP_LENGTH);

  const handleChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(cleaned);
  };

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View>
      <View style={styles.otpInputWrapper}>
        <View className="flex-row gap-2" pointerEvents="none">
          {digits.map((digit, index) => {
            const isEmpty = !digit.trim();
            const isActive = index === value.length && value.length < OTP_LENGTH;
            return (
              <View
                key={index}
                className={`h-[48px] flex-1 items-center justify-center rounded-[10px] border-[1.5px] bg-white ${
                  isActive
                    ? 'border-primary'
                    : isEmpty
                      ? 'border-border'
                      : 'border-text-primary/30'
                }`}
              >
                <Text className="text-lg font-bold text-text-primary">
                  {digit.trim() ? digit : ''}
                </Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          style={styles.otpOverlayInput}
          caretHidden
          autoFocus
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          textContentType="oneTimeCode"
          importantForAutofill="yes"
        />
      </View>
      <ErrorText message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  otpInputWrapper: {
    position: 'relative',
  },
  otpOverlayInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
});
