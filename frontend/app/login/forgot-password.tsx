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
  AuthSub,
  AuthTitle,
  SuccessToast,
  useShake,
} from '@/components/auth/AuthKit';
import { OtpBox } from '@/components/auth/OtpBox';
import { Reveal } from '@/components/auth/Reveal';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { changeUserPassword, loginBusinessWithOtp, sendLoginOtp } from '@/utils/authApi';
import { validatePhone } from '@/utils/validation';

const OTP_LENGTH = 6;

/**
 * Mockup "Forgot Password?" flow (design-mockup #screenForgotPassword):
 * User ID → Send code → 6-digit OTP → new password + confirm → success toast.
 * OTP ownership is proven via the real login-OTP API; the reset then runs
 * against /auth/change-password using the OTP-issued session token.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const savedPhone = useAuthStore((s) => s.savedPhone);

  const [userId, setUserId] = useState(savedPhone || '');
  const [userIdError, setUserIdError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [password1Error, setPassword1Error] = useState<string | null>(null);
  const [password2Error, setPassword2Error] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  const normalizedId = userId.replace(/\D/g, '').slice(0, 10);

  const handleSendCode = async () => {
    const pErr = validatePhone(normalizedId);
    setUserIdError(pErr ? 'Please enter your registered User ID (mobile number)' : null);
    if (pErr) {
      triggerShake();
      return;
    }

    setSending(true);
    try {
      const result = await sendLoginOtp(normalizedId);
      if (!result.success) {
        setUserIdError(result.error ?? 'Failed to send code.');
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
      const result = await loginBusinessWithOtp(normalizedId, value);
      if (!result.success || !result.data) {
        setOtpError(result.error ?? 'Invalid code.');
        triggerShake();
        return;
      }
      setOtpToken(result.data.accessToken);
    } finally {
      setVerifying(false);
    }
  };

  const handleReset = async () => {
    const p1Ok = password1.trim().length >= 6;
    const p2Ok = p1Ok && password2 === password1;
    setPassword1Error(p1Ok ? null : 'Password must be at least 6 characters');
    setPassword2Error(p2Ok ? null : p1Ok ? "Passwords don't match" : null);
    if (!p1Ok || !p2Ok) {
      triggerShake();
      return;
    }

    setResetting(true);
    const store = useAuthStore.getState();
    const previousToken = store.authToken;
    try {
      store.setAuthToken(otpToken);
      const result = await changeUserPassword('', password1);
      if (!result.success) {
        setPassword2Error(result.error ?? 'Failed to reset password.');
        triggerShake();
        return;
      }
      setResetDone(true);
      setTimeout(() => router.replace('/login'), 1600);
    } finally {
      useAuthStore.getState().setAuthToken(previousToken);
      setResetting(false);
    }
  };

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
            <AuthTitle tight>Forgot Password?</AuthTitle>
          </Reveal>
          <Reveal d={1}>
            <AuthSub>Enter your User ID — we&apos;ll text a code to your registered phone.</AuthSub>
          </Reveal>

          <Animated.View style={[styles.form, shakeStyle]}>
            <Reveal d={2}>
              <AuthField
                label="User ID"
                value={userId}
                onChangeText={(text) => {
                  setUserId(text);
                  setUserIdError(null);
                }}
                placeholder="Enter your User ID"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                editable={!codeSent}
                error={userIdError}
                verifyLabel={codeSent ? 'Sent' : sending ? 'Sending…' : 'Send code'}
                onVerifyPress={handleSendCode}
                verifyDisabled={codeSent || sending}
              />
            </Reveal>

            {codeSent && !otpToken ? (
              <OtpBox
                value={otp}
                onChange={handleOtpChange}
                onResend={handleSendCode}
                resendLoading={sending}
              />
            ) : null}

            {otpError ? <AuthErrorText>{otpError}</AuthErrorText> : null}
            {verifying ? <Text style={styles.verifyingText}>Verifying code…</Text> : null}

            {otpToken && !resetDone ? (
              <>
                <AuthField
                  label="New Password"
                  password
                  value={password1}
                  onChangeText={(text) => {
                    setPassword1(text);
                    setPassword1Error(null);
                  }}
                  placeholder="••••••••"
                  autoCapitalize="none"
                  error={password1Error}
                />
                <AuthField
                  label="Confirm New Password"
                  password
                  value={password2}
                  onChangeText={(text) => {
                    setPassword2(text);
                    setPassword2Error(null);
                  }}
                  placeholder="••••••••"
                  autoCapitalize="none"
                  error={password2Error}
                />
                <AuthPrimaryButton
                  title="Reset Password"
                  onPress={handleReset}
                  loading={resetting}
                />
              </>
            ) : null}

            {resetDone ? <SuccessToast message="Password reset successfully." /> : null}
          </Animated.View>
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
});
