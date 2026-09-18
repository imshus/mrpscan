import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';
import { ErrorText } from './ErrorText';

export const MPIN_LENGTH = 4;

interface MpinInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  /** Focus on mount — for the sign-in screen, where it is the only field. */
  autoFocus?: boolean;
  /** Called once the fourth digit is typed, so a form can submit itself. */
  onComplete?: (value: string) => void;
  label?: string;
}

/**
 * The four digits an owner signs in with.
 *
 * Masked, with an eye to reveal it: the mockup shows the same, and a PIN is
 * typed in front of customers across a counter. One hidden field takes the
 * keystrokes and four boxes show the state, which is how the OTP input works —
 * four separately focusable inputs fight the keyboard on Android.
 */
export function MpinInput({
  value,
  onChange,
  error,
  autoFocus = false,
  onComplete,
  label,
}: MpinInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [revealed, setRevealed] = useState(false);
  const digits = value.padEnd(MPIN_LENGTH, ' ').split('').slice(0, MPIN_LENGTH);

  const handleChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, MPIN_LENGTH);
    onChange(cleaned);
    if (cleaned.length === MPIN_LENGTH) onComplete?.(cleaned);
  };

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable
          style={styles.boxes}
          onPress={() => inputRef.current?.focus()}
          accessibilityRole="button"
          accessibilityLabel={label || 'MPIN'}
        >
          {digits.map((digit, index) => {
            const filled = Boolean(digit.trim());
            const active = index === value.length && value.length < MPIN_LENGTH;
            return (
              <View
                key={index}
                style={[
                  styles.box,
                  filled && styles.boxFilled,
                  active && styles.boxActive,
                  error ? styles.boxError : null,
                ]}
              >
                <Text style={styles.digit}>
                  {filled ? (revealed ? digit : '•') : ''}
                </Text>
              </View>
            );
          })}
        </Pressable>

        <Pressable
          onPress={() => setRevealed((shown) => !shown)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={revealed ? 'Hide MPIN' : 'Show MPIN'}
          style={styles.eye}
        >
          {revealed ? (
            <EyeOff size={20} color={Colors.textMuted} />
          ) : (
            <Eye size={20} color={Colors.textMuted} />
          )}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={MPIN_LENGTH}
          style={styles.overlay}
          caretHidden
          autoFocus={autoFocus}
          // Never offered to a password manager as a password, and never
          // remembered by the keyboard.
          autoComplete="off"
          importantForAutofill="no"
          secureTextEntry={false}
        />
      </View>
      <ErrorText message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    position: 'relative',
  },
  boxes: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
  },
  box: {
    height: 52,
    flex: 1,
    maxWidth: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    backgroundColor: Colors.white,
  },
  boxFilled: { borderColor: '#C9B79A' },
  boxActive: { borderColor: Colors.brandDeep },
  boxError: { borderColor: '#D9291F' },
  digit: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  eye: { padding: 4 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
});
