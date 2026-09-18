import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
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
import { AccountCreatedPopup } from '@/components/auth/AccountCreatedPopup';
import { OtpBox } from '@/components/auth/OtpBox';
import { Reveal } from '@/components/auth/Reveal';
import { MPIN_LENGTH, MpinInput } from '@/components/ui/MpinInput';
import { Colors } from '@/constants/theme';
import { useAndroidOtpAutofill } from '@/hooks/useAndroidOtpAutofill';
import { useAuthStore } from '@/store/authStore';
import {
  checkRegistrationAvailability,
  registerBusiness,
  sendLoginOtp,
  verifyAndConfirmBusinessGst,
  verifyLoginOtp,
} from '@/utils/authApi';
import { prepareSignInAfterSignup } from '@/utils/authSession';
import { normalizeGstNumber, validateGst, validatePhone } from '@/utils/validation';

const OTP_LENGTH = 6;
const AVAILABILITY_ERROR = 'Could not check availability. Check your connection and try again.';
type Availability = 'checking' | 'available' | 'taken' | 'error' | null;

/**
 * Creating an account, on one screen (design-mockup #screenSignup).
 *
 * The mockup holds the whole thing in a single view, each part appearing as
 * the one before it is answered: a name and a number, the code texted to that
 * number, the GSTIN and what the lookup says about it, and finally the four
 * digits the shop will sign in with. Nothing that has been answered scrolls
 * away, and nothing is asked for twice.
 *
 * The account is created at the very end, with the MPIN, because that is the
 * credential it is created with — there is nothing to create until it exists.
 * The shop is then signed in with the number and MPIN it just chose.
 */
export default function SignupScreen() {
  const router = useRouter();
  const updateRegistration = useAuthStore((s) => s.updateRegistration);
  const setSavedCredentials = useAuthStore((s) => s.setSavedCredentials);
  const registration = useAuthStore((s) => s.registration);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  // Instant availability feedback for the number, which is the account's
  // identity now: it has to be free before an OTP is spent on it.
  const [phoneStatus, setPhoneStatus] = useState<Availability>(null);
  const phoneCheckSeq = useRef(0);

  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const [gstNumber, setGstNumber] = useState('');
  const [gstError, setGstError] = useState<string | null>(null);
  const [gstChecking, setGstChecking] = useState(false);
  const [business, setBusiness] = useState<{
    businessId: string;
    businessName?: string;
    businessType?: string;
    address?: string;
  } | null>(null);

  const [mpin, setMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [mpinError, setMpinError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  // Held until the popup closes, so the screen does not change under it.
  const [signIn, setSignIn] = useState<(() => Promise<void>) | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const phoneRef = useRef<TextInput>(null);
  const normalizedPhone = phone.replace(/\D/g, '').slice(0, 10);
  const normalizedGst = normalizeGstNumber(gstNumber);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 180);
  };

  const clearError = (key: string) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: null } : prev));

  // A phone problem bounced back from a later step belongs on this field.
  useEffect(() => {
    if (!registration.phoneError) return;
    setErrors((prev) => ({ ...prev, phone: registration.phoneError ?? null }));
    triggerShake();
    updateRegistration({ phoneError: undefined });
  }, [registration.phoneError, triggerShake, updateRegistration]);

  // The moment a full number is typed, ask whether it is free.
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

  /** Editing the name or number un-answers everything that followed them. */
  const invalidateFromDetails = () => {
    setValidationError(null);
    setCodeSent(false);
    setOtp('');
    setOtpError(null);
    setOtpVerified(false);
    setBusiness(null);
  };

  const sendOtp = async () => {
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
      if (availability.phoneTaken) {
        setPhoneStatus('taken');
        setErrors((prev) => ({
          ...prev,
          phone: 'This phone number is already associated with an account.',
        }));
        triggerShake();
        return;
      }

      updateRegistration({ fullName: fullName.trim(), phone: normalizedPhone });

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
    if (verifying || otpVerified) return;
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
      // The GSTIN section appears below, on this same screen.
      setOtpVerified(true);
      scrollToBottom();
    } finally {
      setVerifying(false);
    }
  };

  const handleOtpChange = (value: string) => {
    setOtp(value);
    setOtpError(null);
    if (value.length === OTP_LENGTH) void verifyOtp(value);
  };

  useAndroidOtpAutofill({
    enabled: codeSent && !otpVerified,
    otpLength: OTP_LENGTH,
    onCodeDetected: (detectedOtp) => handleOtpChange(detectedOtp),
    onDetectionError: () => {},
  });

  const verifyGst = async () => {
    const localError = validateGst(normalizedGst);
    setGstError(localError);
    if (localError) {
      triggerShake();
      return;
    }

    setGstChecking(true);
    try {
      const result = await verifyAndConfirmBusinessGst(normalizedGst);
      if (!result.success || !result.businessId) {
        setGstError(result.error ?? 'Could not verify this GSTIN.');
        triggerShake();
        return;
      }
      setBusiness({
        businessId: result.businessId,
        businessName: result.businessName,
        businessType: result.businessType,
        address: result.address,
      });
      updateRegistration({
        businessId: result.businessId,
        gstNumber: normalizedGst,
        businessName: result.businessName,
        businessType: result.businessType,
        address: result.address,
      });
      scrollToBottom();
    } finally {
      setGstChecking(false);
    }
  };

  const createAccount = async () => {
    if (!business) return;
    if (mpin.length !== MPIN_LENGTH) {
      setMpinError('Enter a 4-digit MPIN');
      triggerShake();
      return;
    }
    if (mpin !== confirmMpin) {
      setMpinError("MPINs don't match");
      triggerShake();
      return;
    }

    setRegistering(true);
    setMpinError(null);
    try {
      const registered = await registerBusiness({
        mobile: normalizedPhone,
        mpin,
        fullName: fullName.trim(),
        businessDetails: {
          businessId: business.businessId,
          businessName: business.businessName,
          businessType: business.businessType,
          address: business.address,
        },
      });

      if (!registered.success) {
        setMpinError(registered.error ?? 'Registration failed.');
        triggerShake();
        return;
      }

      setSavedCredentials(normalizedPhone);

      // Signed in with the number and MPIN just chosen, so the shop lands on
      // Home the moment the popup has been read.
      const session = await prepareSignInAfterSignup(normalizedPhone, { mpin });
      setSignIn(() => async () => {
        if (session) await session.activate();
        else router.replace('/login');
      });
      setAccountCreated(true);
    } finally {
      setRegistering(false);
    }
  };

  const otpStage = otpVerified
    ? { title: 'Verified', onPress: () => {}, loading: false, disabled: true }
    : codeSent
      ? { title: 'Verify OTP', onPress: () => void verifyOtp(otp), loading: verifying, disabled: false }
      : {
        title: sending ? 'Sending OTP…' : 'Submit',
        onPress: () => void sendOtp(),
        loading: sending,
        disabled: false,
      };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
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
                  invalidateFromDetails();
                }}
                autoComplete="name"
                error={errors.fullName}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
            </Reveal>

            <Reveal d={2}>
              <AuthField
                label="Phone No."
                prefix="+91"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text.replace(/\D/g, '').slice(0, 10));
                  clearError('phone');
                  invalidateFromDetails();
                }}
                keyboardType="phone-pad"
                maxLength={10}
                error={errors.phone}
                ref={phoneRef}
                returnKeyType="done"
                onSubmitEditing={() => void sendOtp()}
              />
              {phoneStatus === 'checking' ? (
                <Text style={styles.checkingText}>Checking availability…</Text>
              ) : null}
              {phoneStatus === 'available' ? (
                <Text style={styles.availableText}>✓ Phone number available</Text>
              ) : null}
            </Reveal>

            {codeSent && !otpVerified ? (
              <OtpBox
                value={otp}
                onChange={handleOtpChange}
                onResend={() => void sendLoginOtp(normalizedPhone)}
                resendLoading={sending}
              />
            ) : null}
            {otpError ? <AuthErrorText>{otpError}</AuthErrorText> : null}

            <AuthPrimaryButton
              title={otpStage.title}
              onPress={otpStage.onPress}
              loading={otpStage.loading}
              disabled={otpStage.disabled}
              style={styles.cta}
            />

            {/* The GSTIN, on this same screen once the number is proved. */}
            {otpVerified ? (
              <Reveal d={1}>
                <Text style={styles.sectionTitle}>Enter your GST</Text>
                <AuthField
                  label="GSTIN"
                  value={gstNumber}
                  onChangeText={(text) => {
                    setGstNumber(text.toUpperCase());
                    setGstError(null);
                    setBusiness(null);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={15}
                  editable={!business}
                  error={gstError}
                  verifyLabel={business ? undefined : 'Verify'}
                  onVerifyPress={() => void verifyGst()}
                  verifyDisabled={gstChecking}
                />
                {gstChecking ? (
                  <Text style={styles.checkingText}>Checking GST with the server…</Text>
                ) : null}
                {business ? <Text style={styles.availableText}>✓ GST verified</Text> : null}
              </Reveal>
            ) : null}

            {business?.businessName ? (
              <View style={styles.resultCard}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Business Name</Text>
                  <Text style={styles.resultValue}>{business.businessName}</Text>
                </View>
                {business.businessType ? (
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Company Type</Text>
                    <Text style={styles.resultValue}>{business.businessType}</Text>
                  </View>
                ) : null}
                {business.address ? (
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Registered Address</Text>
                    <Text style={styles.resultValue}>{business.address}</Text>
                  </View>
                ) : null}
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>GST Status</Text>
                  <Text style={styles.resultStatus}>● Active</Text>
                </View>
              </View>
            ) : null}

            {/* The credential last, because the account is created with it. */}
            {business ? (
              <Reveal d={1}>
                <Text style={styles.sectionTitle}>Create 4 digit MPIN</Text>
                <View style={styles.mpinGroup}>
                  <MpinInput
                    label="Create"
                    value={mpin}
                    onChange={(next) => {
                      setMpin(next);
                      setMpinError(null);
                    }}
                    autoFocus
                  />
                  <MpinInput
                    label="Confirm"
                    value={confirmMpin}
                    onChange={(next) => {
                      setConfirmMpin(next);
                      setMpinError(null);
                    }}
                    onComplete={() => void createAccount()}
                  />
                </View>
                {mpinError ? <AuthErrorText>{mpinError}</AuthErrorText> : null}
              </Reveal>
            ) : null}

            {validationError ? <AuthErrorText>{validationError}</AuthErrorText> : null}

            {/* The account is created by the Submit below, once there is an
                MPIN to create it with. */}
            {business ? (
              <AuthPrimaryButton
                title="Submit"
                onPress={() => void createAccount()}
                loading={registering}
                style={styles.cta}
              />
            ) : null}
          </Animated.View>

          <AuthSwitch
            prompt="Already have an account?"
            linkText="Log in"
            onPress={() => router.replace('/login')}
          />

          {/* Says the account is made and shows the MPIN it was made with,
              then takes the shop to Home. */}
          <AccountCreatedPopup
            mpin={accountCreated ? mpin : null}
            onDone={() => {
              setAccountCreated(false);
              void signIn?.();
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 40,
  },
  form: { gap: 16 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 12,
    marginTop: 4,
  },
  mpinGroup: { gap: 16 },
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
  resultCard: {
    padding: 16,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    gap: 10,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  resultLabel: {
    fontSize: 13.5,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  resultValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  resultStatus: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.successText,
  },
  cta: { marginTop: 6 },
});
