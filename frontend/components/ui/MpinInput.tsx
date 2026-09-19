import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { Colors, Radius } from '@/constants/theme';
import { ErrorText } from './ErrorText';

export const MPIN_LENGTH = 4;

export interface MpinInputHandle {
  focus: () => void;
}

interface MpinInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  /** Focus on mount — for the sign-in screen, where it is the only field. */
  autoFocus?: boolean;
  /** Called once the fourth digit is typed: move on, or submit. */
  onComplete?: (value: string) => void;
  label?: string;
}

/**
 * The four digits an owner signs in with.
 *
 * Masked, with an eye to reveal it: a PIN is typed in front of customers
 * across a counter. One hidden field takes the keystrokes and four boxes show
 * the state, which is how the OTP input works — four separately focusable
 * inputs fight the keyboard on Android.
 *
 * That hidden field covers the boxes only. It used to cover the whole row,
 * including the eye, so every tap meant to reveal the PIN landed on the input
 * instead and the eye appeared to do nothing.
 */
export const MpinInput = forwardRef<MpinInputHandle, MpinInputProps>(function MpinInput(
  { value, onChange, error, autoFocus = false, onComplete, label },
  ref,
) {
  const inputRef = useRef<TextInput>(null);
  const [revealed, setRevealed] = useState(false);
  const digits = value.padEnd(MPIN_LENGTH, ' ').split('').slice(0, MPIN_LENGTH);

  // Lets the screen move focus on from here — Create to Confirm, without the
  // shop having to reach for the second field.
  //
  // Deferred by a tick on purpose. This is called from inside the previous
  // field's change handler, and Android discards a focus request made while
  // that field is still settling its own — so the jump worked nowhere but in
  // theory until the call waited for the keystroke to finish.
  useImperativeHandle(
    ref,
    () => ({ focus: () => setTimeout(() => inputRef.current?.focus(), 0) }),
    [],
  );

  const handleChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, MPIN_LENGTH);
    onChange(cleaned);
    if (cleaned.length === MPIN_LENGTH) onComplete?.(cleaned);
  };

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {/* The boxes and the field that feeds them, together: the field is
            absolute inside this, so it cannot reach the eye beside it. */}
        <View style={styles.boxesWrap}>
          <View style={styles.boxes}>
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
                  <Text style={styles.digit}>{filled ? (revealed ? digit : '•') : ''}</Text>
                </View>
              );
            })}
          </View>

          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={MPIN_LENGTH}
            style={styles.overlay}
            caretHidden
            autoFocus={autoFocus}
            // Keeps the keyboard up when the fourth digit lands, so focus can
            // move to the next field without it closing and reopening.
            submitBehavior="submit"
            // Never offered to a password manager, never remembered by the
            // keyboard's own suggestions.
            autoComplete="off"
            importantForAutofill="no"
            accessibilityLabel={label || 'MPIN'}
          />
        </View>

        <Pressable
          onPress={() => setRevealed((shown) => !shown)}
          hitSlop={12}
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
      </View>
      <ErrorText message={error} />
    </View>
  );
});

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
  },
  boxesWrap: {
    flex: 1,
    position: 'relative',
  },
  boxes: {
    flexDirection: 'row',
    gap: 10,
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
  eye: { padding: 6 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
});
