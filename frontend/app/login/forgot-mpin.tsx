import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackButton, AuthErrorText, AuthField, AuthPrimaryButton } from '@/components/auth/AuthKit';
import { OtpBox } from '@/components/auth/OtpBox';
import { Reveal } from '@/components/auth/Reveal';
import { MPIN_LENGTH, MpinInput } from '@/components/ui/MpinInput';
import { Colors, Fonts } from '@/constants/theme';
import { useAndroidOtpAutofill } from '@/hooks/useAndroidOtpAutofill';
import {
  requestPasswordReset,
  revealStoredMpin,
  setMpinWithResetToken,
  verifyPasswordResetOtp,
} from '@/utils/authApi';

const tenDigits = (value: string) => value.replace(/\D/g, '').slice(0, 10);

/**
 * Forgot MPIN, on one screen as the design draws it: the number with a Send
 * pill in the field, the code card underneath, then the MPIN large and red
 * under "YOUR MPIN", and Back to Log In.
 *
 * The code now buys the MPIN itself. The server keeps a sealed copy beside
 * the bcrypt hash and hands it back once the OTP has proved the phone, so the
 * shop reads its own four digits and types nothing.
 *
 * An account whose MPIN was set before that copy existed has nothing to show,
 * and only there does the screen fall back to choosing a new one — sealed as
 * it is saved, so the next visit shows it.
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

      // The code is accepted, so ask for the MPIN itself. When the server has
      // a readable copy this screen is finished — the card shows it and the
      // shop never types anything. When it has none (an account whose MPIN
      // was set before the server kept one) the set-a-new-one card appears
      // instead, which is the only thing left that can help.
      const revealed = await revealStoredMpin(result.resetToken);
      if (revealed.mpin) setSavedMpin(revealed.mpin);
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

          {/* The card stays on screen after the code is accepted, as the
              design draws it — the six digits still showing above the MPIN
              rather than vanishing the moment they work. It just stops
              listening once there is nothing left for it to verify. */}
          {sent ? (
            <Reveal d={0}>
              <OtpBox
                value={otp}
                onChange={(value) => {
                  if (resetToken) return;
                  setOtp(value);
                  setError(null);
                  if (value.length === 6) void verify(value);
                }}
                autoFocus={!resetToken}
                onResend={() => {
                  if (!resetToken) void requestPasswordReset(phone);
                }}
              />
            </Reveal>
          ) : null}

          {resetToken && !savedMpin ? (
            <Reveal d={0}>
              <View style={styles.mpinCard}>
                <Text style={[styles.mpinCardLabel, styles.setLabel]}>SET YOUR NEW MPIN</Text>
                <Text style={styles.setNote}>
                  This account was created before we could show an MPIN back.
                  Choose one now and it will be shown here from next time.
                </Text>
                {/* The card centres its children, which left the boxes with no
                    width to flex into — four hairlines instead of four squares.
                    This wrapper hands them the card's full width back. */}
                <View style={styles.mpinInputWrap}>
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
                // The shop has just chosen these four digits and is looking
                // at them; handing them to Log In alongside the number means
                // the only thing left to do there is press the button.
                onPress={() =>
                  router.replace({
                    pathname: '/login',
                    params: { phone, mpin: savedMpin },
                  } as unknown as Href)
                }
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
  setLabel: { marginBottom: 2 },
  setNote: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  mpinInputWrap: { alignSelf: 'stretch' },
  footer: { marginTop: 4 },
});
