import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import {
  AuthErrorText,
  AuthField,
  AuthPrimaryButton,
  useShake,
} from '@/components/auth/AuthKit';
import { Reveal } from '@/components/auth/Reveal';
import { MPIN_LENGTH, MpinInput } from '@/components/ui/MpinInput';
import { OtpInput } from '@/components/ui/OtpInput';
import { Colors } from '@/constants/theme';
import {
  requestPasswordReset,
  setMpinWithResetToken,
  verifyPasswordResetOtp,
} from '@/utils/authApi';

/**
 * Sets the four digits an owner signs in with, proved by an OTP to their
 * registered number.
 *
 * One screen serves two arrivals. "Forgot MPIN?" comes here to replace one,
 * and a sign-in that found no MPIN on the account comes here to set the first
 * — every shop registered before MPINs existed. Only the wording differs;
 * the proof required is the same, which is why the flow is not duplicated.
 */
export default function SetMpinScreen() {
  const router = useRouter();
  const { phone: phoneParam, mode } = useLocalSearchParams<{ phone?: string; mode?: string }>();
  const isFirstTime = mode === 'first';

  const [phone, setPhone] = useState(
    typeof phoneParam === 'string' ? phoneParam.replace(/\D/g, '').slice(-10) : '',
  );
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [deliveryHint, setDeliveryHint] = useState<string | null>(null);

  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const [mpin, setMpin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mpinError, setMpinError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  const sendCode = async () => {
    const normalized = phone.replace(/\D/g, '').slice(-10);
    if (normalized.length !== 10) {
      setPhoneError('Enter the 10-digit number this account is registered on');
      triggerShake();
      return;
    }

    setSending(true);
    setPhoneError(null);
    try {
      const result = await requestPasswordReset(normalized);
      if (!result.success) {
        setPhoneError(result.error ?? 'No account found for this number.');
        triggerShake();
        return;
      }
      setDeliveryHint(result.destination ?? null);
    } finally {
      setSending(false);
    }
  };

  const verify = async (value: string) => {
    if (value.length !== 6 || verifying) return;
    setVerifying(true);
    setOtpError(null);
    try {
      const result = await verifyPasswordResetOtp(phone.replace(/\D/g, '').slice(-10), value);
      if (!result.success || !result.resetToken) {
        setOtp('');
        setOtpError(result.error ?? 'That code is not right.');
        triggerShake();
        return;
      }
      setResetToken(result.resetToken);
    } finally {
      setVerifying(false);
    }
  };

  const save = async () => {
    if (mpin.length !== MPIN_LENGTH) {
      setMpinError('Enter a 4-digit MPIN');
      triggerShake();
      return;
    }
    if (mpin !== confirm) {
      setMpinError("MPINs don't match");
      triggerShake();
      return;
    }
    if (!resetToken) return;

    setSaving(true);
    setMpinError(null);
    try {
      const result = await setMpinWithResetToken(resetToken, mpin, confirm);
      if (!result.success) {
        setMpinError(result.error ?? 'Could not set the MPIN.');
        triggerShake();
        return;
      }
      setDone(true);
      setTimeout(() => router.replace('/login'), 1400);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.2} />
          </Pressable>

          <Reveal d={0}>
            <Text style={styles.title}>{isFirstTime ? 'Set your MPIN' : 'Forgot MPIN?'}</Text>
            <Text style={styles.sub}>
              {isFirstTime
                ? 'This account signs in with a 4-digit MPIN now. Confirm your registered number and choose one.'
                : "Enter your registered phone number — we'll text you a code, then you can choose a new MPIN."}
            </Text>
          </Reveal>

          <Animated.View style={[styles.form, shakeStyle]}>
            {!resetToken ? (
              <>
                <Reveal d={1}>
                  <AuthField
                    label="Phone No."
                    prefix="+91"
                    value={phone}
                    onChangeText={(text) => {
                      setPhone(text.replace(/\D/g, '').slice(0, 10));
                      setPhoneError(null);
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!deliveryHint}
                    error={phoneError}
                    verifyLabel={deliveryHint ? undefined : 'Send code'}
                    onVerifyPress={() => void sendCode()}
                    verifyDisabled={sending}
                  />
                </Reveal>

                {deliveryHint ? (
                  <Reveal d={2}>
                    <Text style={styles.otpLabel}>
                      Enter the 6-digit code sent to {deliveryHint}
                    </Text>
                    <OtpInput
                      value={otp}
                      onChange={(next) => {
                        setOtp(next);
                        setOtpError(null);
                        if (next.length === 6) void verify(next);
                      }}
                      error={otpError}
                    />
                  </Reveal>
                ) : null}
              </>
            ) : done ? (
              <Reveal d={1}>
                <Text style={styles.doneText}>
                  MPIN set. Signing you back in…
                </Text>
              </Reveal>
            ) : (
              <>
                <Reveal d={1}>
                  <MpinInput
                    label={isFirstTime ? 'Create 4 digit MPIN' : 'New MPIN'}
                    value={mpin}
                    onChange={(next) => {
                      setMpin(next);
                      setMpinError(null);
                    }}
                    autoFocus
                  />
                </Reveal>
                <Reveal d={2}>
                  <MpinInput
                    label="Confirm MPIN"
                    value={confirm}
                    onChange={(next) => {
                      setConfirm(next);
                      setMpinError(null);
                    }}
                    onComplete={() => void save()}
                  />
                </Reveal>
                {mpinError ? <AuthErrorText center>{mpinError}</AuthErrorText> : null}
                <Reveal d={3}>
                  <AuthPrimaryButton title="Submit" onPress={() => void save()} loading={saving} />
                </Reveal>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundAlt,
    marginBottom: 18,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  sub: {
    fontSize: 13.5,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 22,
  },
  form: { gap: 18 },
  otpLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  doneText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.successText,
    textAlign: 'center',
  },
});
