import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import {
  AuthBrand,
  AuthErrorText,
  AuthField,
  AuthPrimaryButton,
  AuthSwitch,
  useShake,
} from '@/components/auth/AuthKit';
import { Reveal } from '@/components/auth/Reveal';
import { MPIN_LENGTH, MpinInput } from '@/components/ui/MpinInput';
import { OtpInput } from '@/components/ui/OtpInput';
import { Colors } from '@/constants/theme';
import { useAndroidOtpAutofill } from '@/hooks/useAndroidOtpAutofill';
import { useAuthStore } from '@/store/authStore';
import { fetchPhoneStatus, loginBusiness, sendLoginOtp, verifyLoginOtp } from '@/utils/authApi';
import { REMEMBERED_PHONE_KEY } from '@/utils/clearAppState';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

/** Seconds before a code can be sent again, as the mockup counts them. */
const RESEND_AFTER_SECONDS = 30;

/** Ten digits, however the number was typed or pasted. */
function toPhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(-10);
}

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Log In, as the design mockup has it (mrpscan-design-mockup, login screen):
 * Welcome back; the phone number with Send code; the 6-digit code texted to
 * it, with its resend countdown; and only once the code is right, the MPIN,
 * Forgot MPIN? and Log In, revealed below on the same page. Nothing above
 * folds away, so the number and code stay in view.
 *
 * A phone that has signed in before skips the code, at the shop's asking:
 * after signing out (or the midnight sign-out) it shows the number it knows,
 * locked, with Change beside it, and asks for the MPIN alone. Change drops
 * that number, and a new one is proved with a code first. Coming back from
 * Forgot MPIN (or from setting a first MPIN) is the same: that number was
 * proved there, so it is the known one.
 */
export default function BusinessLoginScreen() {
  const router = useRouter();
  const {
    savedPhone,
    setAuthenticated,
    setAuthToken,
    setRefreshToken,
    setSavedCredentials,
    setUserRole,
    setIsSuper,
    setLoggedInEmployee,
    updateRegistration,
  } = useAuthStore();

  // What Forgot MPIN (or Set MPIN) hands back: the number it proved with a
  // code, and from Forgot MPIN the four digits it showed. Either way the
  // number is already verified, so the screen opens at the MPIN.
  const params = useLocalSearchParams<{ phone?: string; mpin?: string; verified?: string }>();
  const handedBackPhone = toPhone(String(params.phone || ''));
  const handedBackMpin = String(params.mpin || '').replace(/\D/g, '').slice(0, MPIN_LENGTH);

  // The number this phone signs in with: the one handed back, else the one
  // it last signed in with (signing out keeps it). While it stands, Log In
  // is the MPIN alone. `changingNumber` is Change: a number typed instead,
  // proved with a code before the MPIN.
  const [knownPhone, setKnownPhone] = useState(
    handedBackPhone.length === 10 ? handedBackPhone : toPhone(savedPhone || ''),
  );
  const [changingNumber, setChangingNumber] = useState(false);
  const useKnown = knownPhone.length === 10 && !changingNumber;
  const [phone, setPhone] = useState('');

  // After a new build's wipe the store starts empty, but the number survives
  // under its own spared key: read it back, so the shop is asked for the
  // MPIN alone after an update too.
  useEffect(() => {
    if (knownPhone.length === 10) return;
    let cancelled = false;
    void AsyncStorage.getItem(REMEMBERED_PHONE_KEY)
      .then((stored: string | null) => {
        const digits = toPhone(stored || '');
        if (cancelled || digits.length !== 10) return;
        setSavedCredentials(digits);
        setKnownPhone((current) => (current.length === 10 ? current : digits));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lookupPhone = useKnown ? knownPhone : toPhone(phone);

  // Whether the number has an MPIN at all: accounts made before MPINs have
  // none, so their link reads "Create MPIN" and Send code takes them to set
  // one (which proves the number with its own code). Looked up a beat after
  // the tenth digit lands, so typing does not fire a request per keystroke.
  const [phoneHasMpin, setPhoneHasMpin] = useState<boolean | null>(null);
  useEffect(() => {
    if (lookupPhone.length !== 10) {
      setPhoneHasMpin(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchPhoneStatus(lookupPhone).then((status) => {
        if (cancelled) return;
        setPhoneHasMpin(status && status.registered ? status.hasMpin : null);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lookupPhone]);
  const needsMpin = phoneHasMpin === false;

  // The code step. `sentTo` is the number the code went to; once sent the
  // number is locked, as in the mockup, and the button reads Sent.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeSent = sentTo !== null;

  const [mpin, setMpin] = useState(handedBackMpin);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((left) => Math.max(0, left - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async () => {
    if (lookupPhone.length !== 10) {
      setPhoneError('Please enter your phone number');
      triggerShake();
      return;
    }
    setSending(true);
    setPhoneError(null);
    try {
      // No text to a number no account uses; an account from before MPINs
      // goes to set one, which proves the number with its own code.
      const status = await fetchPhoneStatus(lookupPhone);
      if (status && !status.registered) {
        setPhoneError('No account uses this number. Create an account below.');
        triggerShake();
        return;
      }
      if (status && status.registered && status.hasMpin === false) {
        router.push({
          pathname: '/login/set-mpin',
          params: { phone: lookupPhone, mode: 'first' },
        } as unknown as Href);
        return;
      }
      const result = await sendLoginOtp(lookupPhone);
      if (!result.success) {
        setPhoneError(result.error || 'The code could not be sent. Please try again.');
        return;
      }
      setSentTo(lookupPhone);
      setOtp('');
      setOtpError(null);
      setOtpVerified(false);
      setMpin('');
      setInvalid(false);
      setResendIn(RESEND_AFTER_SECONDS);
    } finally {
      setSending(false);
    }
  };

  const changeNumber = () => {
    setChangingNumber(true);
    setPhone('');
    setPhoneError(null);
    setSentTo(null);
    setOtp('');
    setOtpError(null);
    setOtpVerified(false);
    setMpin('');
    setInvalid(false);
  };

  const verifyCode = async (code: string) => {
    if (code.length !== 6 || verifying || !sentTo || otpVerified) return;
    setVerifying(true);
    try {
      const result = await verifyLoginOtp(sentTo, code);
      if (!result.success) {
        setOtpError(result.error || 'That code is not right. Please check it and try again.');
        setOtp('');
        triggerShake();
        return;
      }
      setOtpError(null);
      setOtpVerified(true);
    } finally {
      setVerifying(false);
    }
  };

  useAndroidOtpAutofill({
    enabled: codeSent && !otpVerified,
    onCodeDetected: (detected) => {
      setOtp(detected);
      setOtpError(null);
      void verifyCode(detected);
    },
  });

  const handleLogin = async (submittedMpin = mpin) => {
    // The known number goes straight to the MPIN; a typed one only once its
    // code has been checked.
    const loginPhone = useKnown ? knownPhone : otpVerified && sentTo ? sentTo : null;
    if (!loginPhone) return;
    if (submittedMpin.length !== MPIN_LENGTH) {
      setInvalid(true);
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const result = await loginBusiness(loginPhone, { mpin: submittedMpin });

      // The account exists but has no MPIN — everyone who registered before
      // MPINs did. Send them to set one rather than showing them an error
      // about a credential they were never given.
      if (result.code === 'MPIN_NOT_SET') {
        setMpin('');
        router.push({
          pathname: '/login/set-mpin',
          params: { phone: loginPhone, mode: 'first' },
        } as unknown as Href);
        return;
      }

      if (!result.success || !result.data) {
        setMpin('');
        setInvalid(true);
        triggerShake();
        return;
      }

      const payload = result.data;
      setAuthToken(payload.accessToken);
      if (payload.refreshToken) {
        setRefreshToken(payload.refreshToken);
      }

      const backendRole = payload.role;
      if (backendRole === 'EMP') {
        setUserRole('employee');
        setIsSuper(false);
      } else {
        setUserRole('business');
        setIsSuper(backendRole === 'SUPER');
      }

      setLoggedInEmployee(null);
      setAuthenticated(true);

      updateRegistration({
        businessName: payload.businessName || '',
        gstNumber: payload.gstNumber || '',
        businessType: payload.businessType || '',
        address: payload.address || '',
        phone: payload.phone || loginPhone,
        ...(payload.loginId ? { userId: payload.loginId } : {}),
        ...(payload.fullName ? { fullName: payload.fullName } : {}),
      });

      // Remembered so the next Log In has the number filled in. It is a
      // phone number, not a credential; the code and the MPIN still stand.
      setSavedCredentials(loginPhone);

      router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* The keyboard-aware list alone keeps the field being typed just above
          the keyboard; a KeyboardAvoidingView around it shrank the page a
          second time and threw the field far above it. */}
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <AuthBrand />

        <Animated.View style={[styles.form, shakeStyle]}>
          <Reveal d={0}>
            <Text style={styles.welcome}>Welcome back</Text>
          </Reveal>

          <Reveal d={1}>
            <AuthField
              label="Phone No."
              prefix="+91"
              value={useKnown ? knownPhone : phone}
              onChangeText={(text) => {
                setPhone(text.replace(/\D/g, '').slice(0, 10));
                setPhoneError(null);
              }}
              keyboardType="phone-pad"
              maxLength={10}
              autoComplete="tel"
              editable={!useKnown && !codeSent}
              error={phoneError}
              verifyLabel={useKnown ? 'Change' : codeSent ? 'Sent' : 'Send code'}
              onVerifyPress={() => (useKnown ? changeNumber() : void sendCode())}
              verifyDisabled={useKnown ? false : sending || codeSent}
            />
          </Reveal>

          {/* The code, texted to a number typed above. The known number
              needs none. */}
          {!useKnown && codeSent ? (
            <Reveal d={2}>
              <View style={styles.otpBox}>
                <Text style={styles.otpLabel}>Enter the 6-digit code sent to your phone</Text>
                <OtpInput
                  value={otp}
                  onChange={(next) => {
                    if (otpVerified) return;
                    setOtp(next);
                    setOtpError(null);
                    if (next.length === 6) void verifyCode(next);
                  }}
                  error={otpError}
                />
                {otpVerified ? null : resendIn > 0 ? (
                  <Text style={styles.resendText}>
                    Resend code in <Text style={styles.resendTime}>{formatCountdown(resendIn)}</Text>
                  </Text>
                ) : (
                  <Pressable
                    onPress={() => void sendCode()}
                    disabled={sending}
                    hitSlop={6}
                    style={styles.resendRow}
                  >
                    <Text style={styles.forgotLink}>Resend code</Text>
                  </Pressable>
                )}
              </View>
            </Reveal>
          ) : null}

          {/* The MPIN: at once for the known number, and for a typed one
              below once its code is right. It takes focus as it appears,
              and the page moves to it above the keyboard. */}
          {useKnown || otpVerified ? (
            <>
              <Reveal d={0}>
                <MpinInput
                  label="Enter MPIN"
                  value={mpin}
                  onChange={(next) => {
                    setMpin(next);
                    setInvalid(false);
                  }}
                  autoFocus
                  onComplete={(complete) => void handleLogin(complete)}
                  error={invalid ? '' : null}
                />
                <Pressable
                  onPress={() =>
                    router.push(
                      (needsMpin
                        ? { pathname: '/login/set-mpin', params: { phone: lookupPhone, mode: 'first' } }
                        : { pathname: '/login/forgot-mpin', params: { phone: lookupPhone } }) as unknown as Href,
                    )
                  }
                  style={styles.forgotRow}
                  hitSlop={6}
                >
                  <Text style={styles.forgotLink}>{needsMpin ? 'Create MPIN' : 'Forgot MPIN?'}</Text>
                </Pressable>
              </Reveal>

              {invalid ? <AuthErrorText center>Incorrect MPIN.</AuthErrorText> : null}

              <Reveal d={1}>
                <AuthPrimaryButton
                  title="Log In"
                  onPress={() => void handleLogin()}
                  loading={loading}
                  style={styles.cta}
                />
              </Reveal>
            </>
          ) : null}
        </Animated.View>

        <Reveal d={5}>
          <AuthSwitch
            prompt="New to MRPscan?"
            linkText="Create an account"
            onPress={() => router.push('/register' as Href)}
          />
        </Reveal>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    flexGrow: 1,
    // Anchored to the top rather than centred, so the page does not jump as
    // the code and the MPIN open below.
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  form: { gap: 18 },
  welcome: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  forgotRow: { alignSelf: 'flex-end', marginTop: 8 },
  forgotLink: { fontSize: 13, fontWeight: '600', color: Colors.brandDeep },
  cta: { marginTop: 4 },
  otpBox: {
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  otpLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  resendText: { fontSize: 12.5, color: Colors.textSecondary },
  resendTime: { fontWeight: '800', color: Colors.textPrimary },
  resendRow: { alignSelf: 'flex-start' },
});
