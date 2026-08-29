import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';

import { MrpScanTagLogo } from '@/components/splash/MrpScanTagLogo';
import { GradientView } from '@/components/ui/GradientView';
import { Colors, Fonts, Gradients, Spacing } from '@/constants/theme';

/**
 * Auth design system ported 1:1 from design-mockup/styles.css —
 * the cream/red "auth-scroll" screens (login, signup, GST, forgot flows).
 */

/** Round bordered back button (mockup `.back-btn`). */
export function AuthBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.backBtn}>
      <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.2} />
    </Pressable>
  );
}

/** MRPscan tag logo shown above the login form (mockup `.auth-brand .mini-tag-lg`). */
export function AuthBrand() {
  return (
    <View style={styles.brand}>
      <MrpScanTagLogo width={168} stroke={Colors.border} />
    </View>
  );
}

/** Serif page title (mockup `.auth-title`). */
export function AuthTitle({ children, tight }: { children: ReactNode; tight?: boolean }) {
  return <Text style={[styles.title, tight && styles.titleTight]}>{children}</Text>;
}

/** Muted paragraph under the title (mockup `.auth-sub`). */
export function AuthSub({ children }: { children: ReactNode }) {
  return <Text style={styles.sub}>{children}</Text>;
}

/** Small bold hint above a title (mockup `.gst-hint`). */
export function AuthHint({ children }: { children: ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>;
}

/** Field error line (mockup `.field-error`). */
export function AuthErrorText({ children, center }: { children: ReactNode; center?: boolean }) {
  return <Text style={[styles.errorText, center && styles.errorTextCenter]}>{children}</Text>;
}

interface AuthFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  /** Show an eye toggle and manage secureTextEntry internally. */
  password?: boolean;
  /** Inline pill button inside the input (mockup `.verify-btn`), e.g. "Send code" / "Verify". */
  verifyLabel?: string;
  onVerifyPress?: () => void;
  verifyDisabled?: boolean;
  /** Fixed prefix text inside the input (e.g. "+91"). */
  prefix?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Labelled input (mockup `.field`): 50px, radius 14, 1.5px border,
 * red-focus ring, error state, optional eye toggle / inline verify pill.
 */
export function AuthField({
  label,
  error,
  password,
  verifyLabel,
  onVerifyPress,
  verifyDisabled,
  prefix,
  containerStyle,
  ...inputProps
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  // error === '' marks the field invalid (red border) without its own message row.
  const borderColor = error != null ? Colors.brandDeep : focused ? Colors.brand : Colors.border;

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.inputWrap, { borderColor }]}>
        {prefix ? <Text style={styles.inputPrefix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={Colors.placeholder}
          {...inputProps}
          secureTextEntry={password ? hidden : inputProps.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={styles.input}
        />
        {password ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8} style={styles.eyeBtn}>
            {hidden ? (
              <EyeOff size={20} color={Colors.textMuted} strokeWidth={1.8} />
            ) : (
              <Eye size={20} color={Colors.textMuted} strokeWidth={1.8} />
            )}
          </Pressable>
        ) : null}
        {verifyLabel ? (
          <Pressable
            onPress={onVerifyPress}
            disabled={verifyDisabled}
            style={[styles.verifyBtn, verifyDisabled && styles.verifyBtnDisabled]}
          >
            <Text style={styles.verifyBtnText}>{verifyLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <AuthErrorText>{error}</AuthErrorText> : null}
    </View>
  );
}

interface AuthPrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Brand-gradient pill CTA (mockup `.btn-primary.btn-lg`). */
export function AuthPrimaryButton({ title, onPress, loading, disabled, style }: AuthPrimaryButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.9}
      style={[(loading || disabled) && styles.primaryBtnDisabled, style]}
    >
      <GradientView colors={Gradients.brand} borderRadius={999} style={styles.primaryBtn}>
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.primaryBtnText}>{title}</Text>
        )}
      </GradientView>
    </TouchableOpacity>
  );
}

interface AuthSwitchProps {
  prompt: string;
  linkText: string;
  onPress: () => void;
}

/** Centered bottom switch row (mockup `.auth-switch`). */
export function AuthSwitch({ prompt, linkText, onPress }: AuthSwitchProps) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchText}>
        {prompt}{' '}
        <Text style={styles.switchLink} onPress={onPress}>
          {linkText}
        </Text>
      </Text>
    </View>
  );
}

/** Dark toast with a green check (mockup `.success-toast`). */
export function SuccessToast({ message }: { message: string }) {
  return (
    <View style={styles.toast}>
      <View style={styles.toastCheck}>
        <Text style={styles.toastCheckMark}>✓</Text>
      </View>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

/**
 * Shake-on-error (mockup `@keyframes otpShake`).
 * Returns an animated style to attach and a trigger function.
 */
export function useShake(): [StyleProp<AnimatedStyle<ViewStyle>>, () => void] {
  const x = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const trigger = () => {
    x.value = withSequence(
      withTiming(-2, { duration: 40 }),
      withTiming(3, { duration: 40 }),
      withTiming(-5, { duration: 40 }),
      withTiming(5, { duration: 40 }),
      withTiming(-5, { duration: 40 }),
      withTiming(5, { duration: 40 }),
      withTiming(-5, { duration: 40 }),
      withTiming(3, { duration: 40 }),
      withTiming(-2, { duration: 40 }),
      withTiming(0, { duration: 40 })
    );
  };

  return [style, trigger];
}

export { Animated as AuthAnimated };

const styles = StyleSheet.create({
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  brand: {
    marginBottom: 28,
    alignSelf: 'flex-start',
    shadowColor: '#15120D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 30,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 28,
  },
  titleTight: {
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
    marginBottom: 30,
    marginTop: -18,
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.3,
    marginBottom: 7,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Spacing.inputHeight,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
  },
  inputPrefix: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginRight: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 0,
    height: '100%',
  },
  eyeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  verifyBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  verifyBtnDisabled: {
    opacity: 0.55,
  },
  verifyBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.brandDeep,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.brandDeep,
    marginTop: 6,
  },
  errorTextCenter: {
    textAlign: 'center',
  },
  primaryBtn: {
    height: Spacing.buttonHeight,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 26,
    elevation: 5,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  switchRow: {
    marginTop: 26,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  switchLink: {
    color: Colors.brandDeep,
    fontWeight: '700',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#15120D',
    borderRadius: 16,
    shadowColor: '#15120D',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.4,
    shadowRadius: 28,
    elevation: 6,
  },
  toastCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1A8A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCheckMark: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    color: '#FFFDF9',
  },
});
