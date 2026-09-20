import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackButton, AuthErrorText, AuthField, AuthPrimaryButton } from '@/components/auth/AuthKit';
import { OtpBox } from '@/components/auth/OtpBox';
import { Reveal } from '@/components/auth/Reveal';
import { MPIN_LENGTH, MpinInput } from '@/components/ui/MpinInput';
import { Colors, Fonts } from '@/constants/theme';
import { useAndroidOtpAutofill } from '@/hooks/useAndroidOtpAutofill';
import {
  requestPasswordReset,
  setMpinWithResetToken,
  verifyPasswordResetOtp,
} from '@/utils/authApi';

const tenDigits = (value: string) => value.replace(/\D/g, '').slice(0, 10);

/**
 * Forgot MPIN, on one screen as the design draws it: the number with a Send
 * chip in the field, the code card underneath, then the MPIN large and red
 * under "YOUR MPIN", and Back to Log In.
 *
 * The MPIN it shows is a fresh one the shop sets after the code — the stored
 * one lives only as a hash and cannot be read back, by design.
 */
export default function ForgotMpinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();

  const [phone, setPhone] = useState(() => tenDigits(String(params.phone || '')));
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [mpin, setMpin] = useState('');
  const [savedMpin, setSavedMpin] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (sending || sent) return;
    if (phone.length !== 10) {
      setError('Enter the 10-digit number this account is registered on.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await requestPasswordReset(phone);
      if (!result.success) {
        setError(result.error ?? 'No account found for this number.');
        return;
      }
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  const verify = async (value: string) => {
    if (value.length !== 6 || verifying || resetToken) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyPasswordResetOtp(phone, value);
      if (!result.success || !result.resetToken) {
        setOtp('');
        setError(result.error ?? 'That code is not right.');
        return;
      }
      setResetToken(result.resetToken);
    } finally {
      setVerifying(false);
    }
  };

  const save = async (value: string) => {
    if (value.length !== MPIN_LENGTH || saving || !resetToken) return;
    setSaving(true);
    setError(null);
    try {
      const result = await setMpinWithResetToken(resetToken, value, value);
      if (!result.success) {
        setMpin('');
        setError(result.error ?? 'Could not set the MPIN.');
        return;
      }
      setSavedMpin(value);
    } finally {
      setSaving(false);
    }
  };

  // The code fills itself when the SMS lands, like every verification screen.
  useAndroidOtpAutofill({
    enabled: sent && resetToken === null,
    onCodeDetected: (detectedOtp) => {
      setOtp(detectedOtp);
      setError(null);
      void verify(detectedOtp);
    },
    onDetectionError: () => {},
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AuthBackButton onPress={() => router.back()} />

          <Text style={styles.title}>Forgot MPIN?</Text>
          <Text style={styles.sub}>
            Enter your registered phone number — we&apos;ll text you a code to retrieve your MPIN.
          </Text>

          <AuthField
            label="Phone No."
            value={phone}
            onChangeText={(text: string) => {
              setPhone(tenDigits(text));
              setError(null);
            }}
            keyboardType="phone-pad"
            editable={!sent}
            verifyLabel={sending ? 'Sending…' : sent ? 'Sent' : 'Send code'}
            onVerifyPress={() => void send()}
            verifyDisabled={sent || sending}
          />

          {error ? <AuthErrorText>{error}</AuthErrorText> : null}

          {sent && !resetToken ? (
            <Reveal d={0}>
              <OtpBox
                value={otp}
                onChange={(value) => {
                  setOtp(value);
                  setError(null);
                  if (value.length === 6) void verify(value);
                }}
                onResend={() => void requestPasswordReset(phone)}
              />
            </Reveal>
          ) : null}

          {resetToken && !savedMpin ? (
            <Reveal d={0}>
              <View style={styles.mpinCard}>
                <Text style={[styles.mpinCardLabel, styles.setLabel]}>SET YOUR NEW MPIN</Text>
                <MpinInput
                  value={mpin}
                  onChange={(value: string) => {
                    setMpin(value);
                    setError(null);
                  }}
                  onComplete={(complete: string) => void save(complete)}
                  autoFocus
                />
              </View>
            </Reveal>
          ) : null}

          {savedMpin ? (
            <Reveal d={0}>
              <View style={styles.mpinCard}>
                <Text style={styles.mpinCardLabel}>YOUR MPIN</Text>
                <Text style={styles.mpinDigits}>{savedMpin.split('').join(' ')}</Text>
              </View>
            </Reveal>
          ) : null}

          {savedMpin ? (
            <View style={styles.footer}>
              <AuthPrimaryButton
                title="Back to Log In"
                onPress={() => router.replace('/login')}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 32 },
  // .auth-title: Playfair 1.85rem, -0.01em.
  title: {
    fontSize: 29.5,
    fontFamily: Fonts.display,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 14,
  },
  // .auth-sub: text-dim, 0.92rem, line-height 1.5, 30px below.
  sub: { fontSize: 14.5, color: Colors.textMuted, lineHeight: 22, marginTop: 10, marginBottom: 30 },
  // .recovered-card, to the pixel: bg-alt, 1px dashed border, radius 14,
  // 22/20 padding, 6 gap, 18 below. Shared by the set stage and the reveal.
  mpinCard: {
    marginTop: 16,
    marginBottom: 18,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 6,
  },
  // .recovered-label: 0.78rem, 600, uppercase, 0.05em, text-dim.
  mpinCardLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: Colors.textMuted,
  },
  // .recovered-value: Playfair 1.7rem, gold-deep, 0.15em.
  mpinDigits: {
    fontSize: 27,
    fontFamily: Fonts.display,
    color: Colors.brandDeep,
    letterSpacing: 4,
  },
  setLabel: { marginBottom: 6 },
  footer: { marginTop: 4 },
});
