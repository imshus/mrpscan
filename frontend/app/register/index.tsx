import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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
import { useAuthStore } from '@/store/authStore';
import { sendLoginOtp, verifyLoginOtp } from '@/utils/authApi';
import { validatePhone } from '@/utils/validation';

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

  const normalizedPhone = phone.replace(/\D/g, '').slice(0, 10);

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
      userId: userId.trim() ? null : 'Please choose a User ID',
      password: password.trim().length >= 6 ? null : 'Password must be at least 6 characters',
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
      const result = await sendLoginOtp(normalizedPhone);
      if (!result.success) {
        setErrors((prev) => ({ ...prev, phone: result.error ?? 'Failed to send OTP.' }));
        triggerShake();
        return;
      }
      setCodeSent(true);
    } finally {
      setSending(false);
    }
  };

  const handleOtpChange = async (value: string) => {
    setOtp(value);
    setOtpError(null);
    if (value.length !== OTP_LENGTH || verifying) return;

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

  const submitLabel = codeSent ? 'Sending OTP…' : sending ? 'Sending OTP…' : 'Submit';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
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
                placeholder="Amit Gupta"
                autoComplete="name"
                error={errors.fullName}
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
                placeholder="Gupta Jewellers"
                autoComplete="organization"
                error={errors.company}
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
                placeholder="98765 43210"
                keyboardType="phone-pad"
                error={errors.phone}
              />
            </Reveal>

            <Reveal d={4}>
              <AuthField
                label="Create User ID"
                value={userId}
                onChangeText={(text) => {
                  setUserId(text);
                  clearError('userId');
                }}
                placeholder="Choose a User ID"
                autoCapitalize="none"
                autoCorrect={false}
                error={errors.userId}
              />
            </Reveal>

            <Reveal d={5}>
              <AuthField
                label="Password"
                password
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  clearError('password');
                }}
                placeholder="••••••••"
                autoCapitalize="none"
                error={errors.password}
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
                onPress={handleSubmit}
                loading={sending}
                disabled={codeSent}
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
  verifyingText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  cta: {
    marginTop: 6,
  },
});
