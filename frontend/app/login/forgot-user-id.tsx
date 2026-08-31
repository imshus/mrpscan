import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
  useShake,
} from '@/components/auth/AuthKit';
import { OtpBox } from '@/components/auth/OtpBox';
import { Reveal } from '@/components/auth/Reveal';
import { Colors, Fonts } from '@/constants/theme';
import { recoverUserId, sendLoginOtp } from '@/utils/authApi';
import { validatePhone } from '@/utils/validation';

const OTP_LENGTH = 6;

/**
 * Mockup "Forgot User ID?" flow (design-mockup #screenForgotId):
 * phone → Send code → 6-digit OTP → recovered User ID card → back to Log In.
 *
 * The code is verified by /auth/forgot-user-id, which looks the phone number
 * up in the database and returns that account's User ID and nothing else — no
 * session is issued, since recovering a username should not grant access.
 */
export default function ForgotUserIdScreen() {
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [recoveredId, setRecoveredId] = useState<string | null>(null);
  const [shakeStyle, triggerShake] = useShake();

  const normalizedPhone = phone.replace(/\D/g, '').slice(0, 10);

  const handleSendCode = async () => {
    const pErr = validatePhone(normalizedPhone);
    setPhoneError(pErr);
    if (pErr) {
      triggerShake();
      return;
    }

    setSending(true);
    try {
      const result = await sendLoginOtp(normalizedPhone);
      if (!result.success) {
        setPhoneError(result.error ?? 'Failed to send code.');
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
      // Looks the User ID up against the phone number in the database. Returns
      // the ID only — no session is issued for recovering a username.
      const result = await recoverUserId(normalizedPhone, value);
      if (!result.success || !result.userId) {
        setOtpError(result.error ?? 'Invalid code.');
        triggerShake();
        return;
      }
      setRecoveredId(result.userId);
    } finally {
      setVerifying(false);
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
            <AuthTitle tight>Forgot User ID?</AuthTitle>
          </Reveal>
          <Reveal d={1}>
            <AuthSub>
              Enter your registered phone number — we&apos;ll text you a code to recover it.
            </AuthSub>
          </Reveal>

          <Animated.View style={[styles.form, shakeStyle]}>
            <Reveal d={2}>
              <AuthField
                label="Phone No."
                prefix="+91"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text.replace(/\D/g, '').slice(0, 10));
                  setPhoneError(null);
                }}
                placeholder="Enter your number"
                keyboardType="phone-pad"
                editable={!codeSent}
                error={phoneError}
                verifyLabel={codeSent ? 'Sent' : sending ? 'Sending…' : 'Send code'}
                onVerifyPress={handleSendCode}
                verifyDisabled={codeSent || sending}
              />
            </Reveal>

            {codeSent && !recoveredId ? (
              <OtpBox
                value={otp}
                onChange={handleOtpChange}
                onResend={handleSendCode}
                resendLoading={sending}
              />
            ) : null}

            {otpError ? <AuthErrorText>{otpError}</AuthErrorText> : null}
            {verifying ? <Text style={styles.verifyingText}>Verifying code…</Text> : null}

            {recoveredId ? (
              <>
                <View style={styles.recoveredCard}>
                  <Text style={styles.recoveredLabel}>Your User ID</Text>
                  <Text style={styles.recoveredValue}>{recoveredId}</Text>
                </View>
                <AuthPrimaryButton
                  title="Back to Log In"
                  onPress={() => router.replace('/login')}
                />
              </>
            ) : null}
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
  recoveredCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 22,
    paddingHorizontal: 20,
    marginBottom: 2,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
  },
  recoveredLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recoveredValue: {
    fontFamily: Fonts.display,
    fontSize: 27,
    fontWeight: '700',
    color: Colors.brandDeep,
    letterSpacing: 0.5,
  },
});
