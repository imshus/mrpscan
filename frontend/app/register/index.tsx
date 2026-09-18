import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  type TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import {
  AuthBackButton,
  AuthErrorText,
  AuthField,
  AuthPrimaryButton,
  AuthSwitch,
  AuthTitle,
  useShake,
} from '@/components/auth/AuthKit';
import { OtpBox } from '@/components/auth/OtpBox';
import { Reveal } from '@/components/auth/Reveal';
import { Colors } from '@/constants/theme';
import { useAndroidOtpAutofill } from '@/hooks/useAndroidOtpAutofill';
import { useAuthStore } from '@/store/authStore';
import { checkRegistrationAvailability, sendLoginOtp, verifyLoginOtp } from '@/utils/authApi';
import { validatePhone } from '@/utils/validation';

const OTP_LENGTH = 6;
const AVAILABILITY_ERROR = 'Could not check availability. Check your connection and try again.';
type Availability = 'checking' | 'available' | 'taken' | 'error' | null;

/**
 * The mockup's Create New Account screen (design-mockup #screenSignup): a full
 * name and a phone number, and nothing else. The company name comes from the
 * GST lookup two steps on, and the credential is the MPIN set at the end — so
 * neither is asked for here.
 *
 * Submit sends the phone OTP and opens the inline OTP box (mockup
 * .otp-collapse); once the code auto-verifies, the flow continues
 * to GST verification, and from there to the MPIN that creates the account.
 */
export default function SignupScreen() {
  const router = useRouter();
  const updateRegistration = useAuthStore((s) => s.updateRegistration);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  // Instant availability feedback for the phone number, which is now the only
  // thing that has to be free before the OTP is sent.
  const [phoneStatus, setPhoneStatus] = useState<Availability>(null);
  const phoneCheckSeq = useRef(0);

  const scrollRef = useRef<ScrollView>(null);
  const phoneRef = useRef<TextInput>(null);

  // Keyboard-avoiding padding alone leaves bottom fields right at the keyboard
  // edge; nudge the scroll after the keyboard settles so they stay visible.
  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  // Programmatic focus (Enter → next field) doesn't auto-scroll on Android;
  // measure the focused input against the scroll content and bring it up.
  const scrollToInput = (ref: React.RefObject<TextInput | null>, fallbackY: number) => {
    setTimeout(() => {
      const scroll = scrollRef.current;
      const input = ref.current;
      if (!scroll || !input) return;
      const inner = (scroll as any).getInnerViewRef?.() ?? (scroll as any).getInnerViewNode?.();
      try {
        input.measureLayout(
          inner,
          (_x: number, y: number) => scroll.scrollTo({ y: Math.max(0, y - 90), animated: true }),
          () => scroll.scrollTo({ y: fallbackY, animated: true }),
        );
      } catch {
        scroll.scrollTo({ y: fallbackY, animated: true });
      }
    }, 150);
  };

  const normalizedPhone = phone.replace(/\D/g, '').slice(0, 10);

  // A later step (GST confirm) can bounce back a phone problem - e.g. the
  // number is already registered. Show it here, on the field that owns it.
  const registration = useAuthStore((s) => s.registration);
  useEffect(() => {
    if (!registration.phoneError) return;
    setErrors((prev) => ({ ...prev, phone: registration.phoneError ?? null }));
    triggerShake();
    updateRegistration({ phoneError: undefined });
  }, [registration.phoneError, triggerShake, updateRegistration]);

  // Instant backend check: the moment a full phone number is typed, ask
  // whether it is free and say so right on the field.
  useEffect(() => {
    const seq = ++phoneCheckSeq.current;
    if (normalizedPhone.length !== 10) {
      setPhoneStatus(null);
      return;
    }
    setPhoneStatus('checking');
    const timer = setTimeout(async () => {
      const result = await checkRegistrationAvailability({ mobile: normalizedPhone, userId: '' });
      if (seq !== phoneCheckSeq.current) return;
      if (!result.success) {
        setPhoneStatus('error');
        setErrors((prev) => ({ ...prev, phone: result.error ?? AVAILABILITY_ERROR }));
        return;
      }
      if (result.phoneTaken) {
        setPhoneStatus('taken');
        setErrors((prev) => ({
          ...prev,
          phone: 'This phone number is already associated with an account.',
        }));
      } else {
        setPhoneStatus('available');
        setErrors((prev) => ({ ...prev, phone: null }));
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      if (phoneCheckSeq.current === seq) phoneCheckSeq.current += 1;
    };
  }, [normalizedPhone]);

  const clearError = (key: string) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: null } : prev));

  const resetOtpState = () => {
    setCodeSent(false);
    setOtp('');
    setOtpError(null);
  };

  const invalidateSubmittedSignup = () => {
    setValidationError(null);
    resetOtpState();
  };

  const handleSubmit = async () => {
    const nextErrors: Record<string, string | null> = {
      fullName: fullName.trim() ? null : 'Please enter your full name',
      phone: validatePhone(normalizedPhone),
    };
    setErrors(nextErrors);
    setValidationError(null);

    if (Object.values(nextErrors).some(Boolean)) {
      triggerShake();
      return;
    }

    setSending(true);
    try {
      // The number is the account's identity now, so it has to be free before
      // an OTP is spent on it — and a taken one errors on its own field.
      const availability = await checkRegistrationAvailability({
        mobile: normalizedPhone,
        userId: '',
      });
      phoneCheckSeq.current += 1;

      if (!availability.success) {
        setPhoneStatus('error');
        setValidationError(availability.error ?? AVAILABILITY_ERROR);
        triggerShake();
        return;
      }

      setPhoneStatus(availability.phoneTaken ? 'taken' : 'available');
      if (availability.phoneTaken) {
        setErrors((prev) => ({
          ...prev,
          phone: 'This phone number is already associated with an account.',
        }));
        triggerShake();
        return;
      }

      // Only a draft the backend has already accepted reaches the GST step.
      updateRegistration({
        fullName: fullName.trim(),
        phone: normalizedPhone,
      });

      const result = await sendLoginOtp(normalizedPhone);
      if (!result.success) {
        setErrors((prev) => ({ ...prev, phone: result.error ?? 'Failed to send OTP.' }));
        triggerShake();
        return;
      }
      setCodeSent(true);
      scrollToBottom();
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async (value: string) => {
    if (verifying) return;
    if (value.length !== OTP_LENGTH) {
      setOtpError('Enter the 6-digit code sent to your phone.');
      triggerShake();
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyLoginOtp(normalizedPhone, value);
      if (!result.success) {
        setOtpError(result.error ?? 'Invalid OTP.');
        triggerShake();
        return;
      }
      router.push('/register/gst');
    } finally {
      setVerifying(false);
    }
  };

  const handleOtpChange = (value: string) => {
    setOtp(value);
    setOtpError(null);
    if (value.length === OTP_LENGTH) {
      void verifyOtp(value);
    }
  };

  useAndroidOtpAutofill({
    enabled: codeSent,
    otpLength: OTP_LENGTH,
    onCodeDetected: (detectedOtp) => {
      console.log('[auth] Auto OTP Detected');
      handleOtpChange(detectedOtp);
    },
    onDetectionError: (message) => {
      console.log('[auth] Auto OTP Detection Failed:', message);
    },
  });

  const handlePrimaryPress = () => {
    if (codeSent) {
      void verifyOtp(otp);
      return;
    }
    void handleSubmit();
  };

  const submitLabel = sending ? 'Sending OTP…' : codeSent ? 'Verify OTP' : 'Submit';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <AuthBackButton onPress={() => router.back()} />

          <Reveal d={0}>
            <AuthTitle>Create New Account</AuthTitle>
          </Reveal>

          <Animated.View style={[styles.form, shakeStyle]}>
            <Reveal d={1}>
              <AuthField
                label="Full Name"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  clearError('fullName');
                  invalidateSubmittedSignup();
                }}
                                autoComplete="name"
                error={errors.fullName}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
            </Reveal>

            <Reveal d={3}>
              <AuthField
                label="Phone No."
                prefix="+91"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text.replace(/\D/g, '').slice(0, 10));
                  clearError('phone');
                  invalidateSubmittedSignup();
                }}
                                keyboardType="phone-pad"
                error={errors.phone}
                ref={phoneRef}
                onFocus={() => scrollToInput(phoneRef, 240)}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={handlePrimaryPress}
              />
              {phoneStatus === 'checking' ? (
                <Text style={styles.checkingText}>Checking availability…</Text>
              ) : null}
              {phoneStatus === 'available' ? (
                <Text style={styles.availableText}>✓ Phone number available</Text>
              ) : null}
            </Reveal>

            {codeSent ? (
              <OtpBox
                value={otp}
                onChange={handleOtpChange}
                onResend={() => void sendLoginOtp(normalizedPhone)}
                resendLoading={sending}
              />
            ) : null}

            {otpError ? <AuthErrorText>{otpError}</AuthErrorText> : null}
            {validationError ? <AuthErrorText>{validationError}</AuthErrorText> : null}
            {verifying ? <Text style={styles.verifyingText}>Verifying OTP…</Text> : null}

            <Reveal d={6}>
              <AuthPrimaryButton
                title={submitLabel}
                onPress={handlePrimaryPress}
                loading={sending || verifying}
                style={styles.cta}
              />
            </Reveal>
          </Animated.View>

          <Reveal d={7}>
            {/* This screen is where the app now opens, so the way back to
                Login has to read correctly: the person who needs it is not a
                new user, they are one who already has an account. */}
            <AuthSwitch
              prompt="Already have an account?"
              linkText="Log in"
              onPress={() => router.replace('/login')}
            />
          </Reveal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 40,
  },
  form: {
    gap: 16,
  },
  checkingText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  availableText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#1F8A4C',
  },
  verifyingText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  cta: {
    marginTop: 6,
  },
});
