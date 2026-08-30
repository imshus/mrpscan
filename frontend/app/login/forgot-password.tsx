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
import {
  requestPasswordReset,
  resetForgottenPassword,
  verifyPasswordResetOtp,
} from '@/utils/authApi';
import {
  validateConfirmPassword,
  validatePassword,
  validatePhone,
  validateUserId,
} from '@/utils/validation';

const OTP_LENGTH = 6;

/**
 * Mockup "Forgot Password?" flow (design-mockup #screenForgotPassword):
 * User ID/phone → Send code → 6-digit OTP → new password + confirm → success.
 * This uses the dedicated password-recovery routes, so the normal
 * current-password requirement is never applied to a verified recovery.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const savedPhone = useAuthStore((s) => s.savedPhone);

  const [userId, setUserId] = useState(savedPhone || '');
  const [userIdError, setUserIdError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [deliveryHint, setDeliveryHint] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [password1Error, setPassword1Error] = useState<string | null>(null);
  const [password2Error, setPassword2Error] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  const normalizeIdentifier = (value: string) => {
    const raw = value.trim();
    const digits = raw.replace(/\D/g, '');
    return /^[+\d\s()-]+$/.test(raw) && digits.length === 10 ? digits : raw;
  };

  const normalizedId = normalizeIdentifier(userId);

  const handleSendCode = async () => {
    const identifierError = /^\d{10}$/.test(normalizedId)
      ? validatePhone(normalizedId)
      : validateUserId(normalizedId);
    setUserIdError(identifierError);
    if (identifierError) {
      triggerShake();
      return;
    }

    setUserIdError(null);
    setSending(true);
    try {
      const result = await requestPasswordReset(normalizedId);
      if (!result.success) {
        setUserIdError(result.error ?? 'Failed to send code.');
        triggerShake();
        return;
      }
      setOtp('');
      setOtpError(null);
      setResetToken(null);
      setDeliveryHint(result.destination ?? null);
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
      const result = await verifyPasswordResetOtp(normalizedId, value);
      if (!result.success || !result.resetToken) {
        setOtpError(result.error ?? 'Invalid code.');
        triggerShake();
        return;
      }
      setResetToken(result.resetToken);
    } finally {
      setVerifying(false);
    }
  };

  const handleReset = async () => {
    const p1Error = validatePassword(password1);
    const p2Error = validateConfirmPassword(password1, password2);
    setPassword1Error(p1Error);
    setPassword2Error(p2Error);
    if (p1Error || p2Error || !resetToken) {
      if (!resetToken) setPassword2Error('Please verify the OTP again.');
      triggerShake();
      return;
    }

    setResetting(true);
    try {
      const result = await resetForgottenPassword(resetToken, password1, password2);
      if (!result.success) {
        setPassword2Error(result.error ?? 'Failed to reset password.');
        triggerShake();
        return;
      }
      setResetDone(true);
      setTimeout(() => router.replace('/login'), 1600);
    } finally {
      setResetting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
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
            <AuthSub>Enter your User ID or phone number — we&apos;ll text a code to your registered phone.</AuthSub>
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
                keyboardType="default"
                editable={!codeSent}
                error={userIdError}
                verifyLabel={codeSent ? 'Sent' : sending ? 'Sending…' : 'Send code'}
                onVerifyPress={handleSendCode}
                verifyDisabled={codeSent || sending}
              />
            </Reveal>

            {codeSent && deliveryHint ? (
              <Text style={styles.verifyingText}>Code sent to {deliveryHint}</Text>
            ) : null}

            {codeSent && !resetToken ? (
              <OtpBox
                value={otp}
                onChange={handleOtpChange}
                onResend={handleSendCode}
                resendLoading={sending}
              />
            ) : null}

            {otpError ? <AuthErrorText>{otpError}</AuthErrorText> : null}
            {verifying ? <Text style={styles.verifyingText}>Verifying code…</Text> : null}

            {resetToken && !resetDone ? (
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
