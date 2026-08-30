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
import { validatePassword, validatePhone, validateUserId } from '@/utils/validation';

const OTP_LENGTH = 6;

/**
 * Mockup "Get started" signup form (design-mockup #screenSignup):
 * Full Name, Company Name, Phone No., Create User ID, Password.
 * Submit sends the phone OTP and opens the inline OTP box (mockup
 * .otp-collapse); once the code auto-verifies, the flow continues
 * to GST verification.
 */
export default function SignupScreen() {
  const router = useRouter();
  const updateRegistration = useAuthStore((s) => s.updateRegistration);

  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  // Instant availability feedback for phone and User ID.
  type Availability = 'checking' | 'available' | 'taken' | null;
  const [phoneStatus, setPhoneStatus] = useState<Availability>(null);
  const [userIdStatus, setUserIdStatus] = useState<Availability>(null);
  const phoneCheckSeq = useRef(0);
  const userIdCheckSeq = useRef(0);

  const scrollRef = useRef<ScrollView>(null);
  const companyRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const userIdRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

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
    if (!registration.phoneError && !registration.userIdError && !registration.passwordError) return;
    setErrors((prev) => ({
      ...prev,
      ...(registration.phoneError ? { phone: registration.phoneError } : {}),
      ...(registration.userIdError ? { userId: registration.userIdError } : {}),
      ...(registration.passwordError ? { password: registration.passwordError } : {}),
    }));
    triggerShake();
    updateRegistration({ phoneError: undefined, userIdError: undefined, passwordError: undefined });
  }, [
    registration.phoneError,
    registration.userIdError,
    registration.passwordError,
    triggerShake,
    updateRegistration,
  ]);

  // Instant backend check: the moment a full phone number is typed, ask
  // whether it is free and say so right on the field.
  useEffect(() => {
    if (normalizedPhone.length !== 10) {
      setPhoneStatus(null);
      return;
    }
    const seq = ++phoneCheckSeq.current;
    setPhoneStatus('checking');
    const timer = setTimeout(async () => {
      const result = await checkRegistrationAvailability({ mobile: normalizedPhone, userId: '' });
      if (seq !== phoneCheckSeq.current) return;
      if (!result.success) {
        setPhoneStatus(null);
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
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [normalizedPhone]);

  // Same for the User ID, once it reaches the minimum length.
  const trimmedUserId = userId.trim();
  useEffect(() => {
    if (trimmedUserId.length < 3) {
      setUserIdStatus(null);
      return;
    }
    const seq = ++userIdCheckSeq.current;
    setUserIdStatus('checking');
    const timer = setTimeout(async () => {
      const result = await checkRegistrationAvailability({ mobile: '', userId: trimmedUserId });
      if (seq !== userIdCheckSeq.current) return;
      if (!result.success) {
        setUserIdStatus(null);
        return;
      }
      if (result.userIdTaken) {
        setUserIdStatus('taken');
        setErrors((prev) => ({
          ...prev,
          userId: 'This User ID is already taken. Please choose another.',
        }));
      } else {
        setUserIdStatus('available');
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [trimmedUserId]);

  const clearError = (key: string) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: null } : prev));

  const resetOtpState = () => {
    setCodeSent(false);
    setOtp('');
    setOtpError(null);
  };

  const handleSubmit = async () => {
    const nextErrors: Record<string, string | null> = {
      fullName: fullName.trim() ? null : 'Please enter your full name',
      company: company.trim() ? null : 'Please enter your company name',
      phone: validatePhone(normalizedPhone),
      userId: validateUserId(userId),
      password: validatePassword(password),
    };
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      triggerShake();
      return;
    }

    updateRegistration({
      fullName: fullName.trim(),
      companyName: company.trim(),
      phone: normalizedPhone,
      userId: userId.trim(),
      password,
    });

    setSending(true);
    try {
      // Uniqueness lives on this page: verify phone + User ID are free before
      // the OTP is ever sent, so taken values error on their own fields here.
      const availability = await checkRegistrationAvailability({
        mobile: normalizedPhone,
        userId: userId.trim(),
      });
      if (availability.phoneTaken || availability.userIdTaken) {
        setErrors((prev) => ({
          ...prev,
          ...(availability.phoneTaken
            ? { phone: 'This phone number is already associated with an account.' }
            : {}),
          ...(availability.userIdTaken
            ? { userId: 'This User ID is already taken. Please choose another.' }
            : {}),
        }));
        triggerShake();
        return;
      }

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
            <AuthTitle>Get started</AuthTitle>
          </Reveal>

          <Animated.View style={[styles.form, shakeStyle]}>
            <Reveal d={1}>
              <AuthField
                label="Full Name"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  clearError('fullName');
                }}
                                autoComplete="name"
                error={errors.fullName}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => companyRef.current?.focus()}
              />
            </Reveal>

            <Reveal d={2}>
              <AuthField
                label="Company Name"
                value={company}
                onChangeText={(text) => {
                  setCompany(text);
                  clearError('company');
                }}
                                autoComplete="organization"
                error={errors.company}
                ref={companyRef}
                onFocus={() => scrollToInput(companyRef, 150)}
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
                  resetOtpState();
                }}
                                keyboardType="phone-pad"
                error={errors.phone}
                ref={phoneRef}
                onFocus={() => scrollToInput(phoneRef, 240)}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => userIdRef.current?.focus()}
              />
              {phoneStatus === 'checking' ? (
                <Text style={styles.checkingText}>Checking availability…</Text>
              ) : null}
              {phoneStatus === 'available' ? (
                <Text style={styles.availableText}>✓ Phone number available</Text>
              ) : null}
            </Reveal>

            <Reveal d={4}>
              <AuthField
                label="Create User ID"
                value={userId}
                onChangeText={(text) => {
                  setUserId(text);
                  clearError('userId');
                }}
                                autoCapitalize="none"
                autoCorrect={false}
                error={errors.userId}
                ref={userIdRef}
                onFocus={scrollToBottom}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              {userIdStatus === 'checking' ? (
                <Text style={styles.checkingText}>Checking availability…</Text>
              ) : null}
              {userIdStatus === 'available' ? (
                <Text style={styles.availableText}>✓ User ID available</Text>
              ) : null}
            </Reveal>

            <Reveal d={5}>
              <AuthField
                label="Password"
                password
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrors((prev) => ({
                    ...prev,
                    password: text ? validatePassword(text) : null,
                  }));
                }}
                                autoCapitalize="none"
                error={errors.password}
                ref={passwordRef}
                onFocus={scrollToBottom}
                returnKeyType="done"
                onSubmitEditing={handlePrimaryPress}
              />
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
            <AuthSwitch
              prompt="New user?"
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
