import { useCallback, useEffect, useRef, useState } from 'react';
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
  AuthHint,
  AuthPrimaryButton,
  AuthSwitch,
  AuthTitle,
  SuccessToast,
  useShake,
} from '@/components/auth/AuthKit';
import { Reveal } from '@/components/auth/Reveal';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import {
  confirmBusinessGst,
  loginBusiness,
  registerBusiness,
  submitBusinessContactDetails,
  verifyBusinessGst,
} from '@/utils/authApi';
import { normalizeGstNumber, validateGst } from '@/utils/validation';

type GstCheckStatus = 'idle' | 'checking' | 'verified' | 'invalid';

export default function GstVerificationScreen() {
  const router = useRouter();
  const registration = useAuthStore((s) => s.registration);
  const updateRegistration = useAuthStore((s) => s.updateRegistration);
  const {
    setAuthenticated,
    setAuthToken,
    setRefreshToken,
    setUserRole,
    setIsSuper,
    setLoggedInEmployee,
    setSavedCredentials,
  } = useAuthStore();

  const [gstNumber, setGstNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [address, setAddress] = useState('');
  const [gstVerified, setGstVerified] = useState(false);
  const [gstStatus, setGstStatus] = useState<GstCheckStatus>('idle');
  const gstCheckSeq = useRef(0);
  // gstError belongs to the GSTIN input; formError covers everything after it
  // (registration, login, server faults) so those never mark the GSTIN red.
  const [gstError, setGstError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  const verifyGstCandidate = useCallback(async (candidate: string, seq: number) => {
    const error = validateGst(candidate);
    if (error) {
      if (seq === gstCheckSeq.current) {
        setGstError(error);
        setGstStatus('invalid');
      }
      return false;
    }

    setGstStatus('checking');
    setGstError(null);
    setFormError(null);
    setBusinessName('');
    setBusinessType('');
    setAddress('');
    setGstVerified(false);
    try {
      const result = await verifyBusinessGst(candidate);
      if (seq !== gstCheckSeq.current) return false;
      if (!result.success) {
        setGstError(result.error ?? 'GST verification failed');
        setGstStatus('invalid');
        return false;
      }

      setBusinessName(result.businessName ?? '');
      setBusinessType(result.businessType ?? '');
      setAddress(result.address ?? '');
      setGstVerified(true);
      setGstStatus('verified');
      return true;
    } catch (error) {
      if (seq !== gstCheckSeq.current) return false;
      setGstError(error instanceof Error ? error.message : 'GST verification failed.');
      setGstStatus('invalid');
      return false;
    }
  }, []);

  const normalizedGst = normalizeGstNumber(gstNumber);

  // A complete, structurally valid GSTIN is verified automatically after the
  // user pauses typing. Sequence invalidation prevents stale responses from
  // updating a newer value.
  useEffect(() => {
    const seq = ++gstCheckSeq.current;

    if (!normalizedGst) {
      setGstStatus('idle');
      setGstError(null);
      return;
    }

    if (normalizedGst.length < 15) {
      setGstStatus('idle');
      setGstError(null);
      return;
    }

    const localError = validateGst(normalizedGst);
    if (localError) {
      setGstStatus('invalid');
      setGstError(localError);
      return;
    }

    setGstStatus('checking');
    const timer = setTimeout(() => {
      void verifyGstCandidate(normalizedGst, seq);
    }, 500);

    return () => {
      clearTimeout(timer);
      if (gstCheckSeq.current === seq) gstCheckSeq.current += 1;
    };
  }, [normalizedGst, verifyGstCandidate]);

  // The phone number is owned by the "Get started" form. Backend failures about
  // it must be shown there, against that field — never on the GST screen.
  const isPhoneProblem = (message?: string | null) => {
    const text = (message ?? "").toLowerCase();
    return (
      text.includes("phone") ||
      text.includes("mobile") ||
      text.includes("already associated")
    );
  };

  const sendBackToPhone = (message: string) => {
    updateRegistration({ phoneError: message });
    router.back();
  };

  const isUserIdProblem = (message?: string | null) => {
    // Matches "User ID", "userId" and Joi's quoted '"userId"' variants.
    const text = (message ?? '').toLowerCase().replace(/[^a-z]/g, '');
    return text.includes('userid');
  };

  const sendBackToUserId = (message: string) => {
    updateRegistration({ userIdError: message });
    router.back();
  };

  const isPasswordProblem = (message?: string | null) =>
    (message ?? '').toLowerCase().includes('password');

  const sendBackToPassword = (message: string) => {
    updateRegistration({ passwordError: message });
    router.back();
  };

  const handleConfirmAndContinue = async () => {
    if (!gstVerified) {
      const seq = ++gstCheckSeq.current;
      await verifyGstCandidate(normalizedGst, seq);
      return;
    }

    const error = validateGst(gstNumber);
    setGstError(error);
    if (error) return;

    setLoading(true);
    try {
      const confirmed = await confirmBusinessGst(gstNumber);
      updateRegistration({
        businessId: confirmed.businessId,
        gstNumber: normalizeGstNumber(gstNumber),
        businessName,
        businessType,
        address,
      });

      // Phone and password are owned by the "Get started" form. If either is
      // missing, send the user back to the screen that can fix it — showing a
      // password or phone message under the GSTIN input is wrong.
      const phone = registration.phone?.replace(/\D/g, '').slice(0, 10);
      const password = registration.password;
      if (!phone || phone.length !== 10) {
        sendBackToPhone('Enter a valid 10-digit phone number.');
        return;
      }
      if (!password) {
        // Back to the Get started form, which owns the password field.
        router.back();
        return;
      }

      // Phone OTP was already verified on the "Get started" form, so finish
      // registration here — mockup shows the success toast on this screen.
      const registered = await registerBusiness({
        mobile: phone,
        password,
        userId: registration.userId,
        businessDetails: {
          businessId: confirmed.businessId,
          businessName,
          businessType,
          address,
        },
      });

      if (!registered.success) {
        // Older backend without pre-GST OTP support — fall back to its
        // businessId-bound OTP round.
        if (registered.error?.toLowerCase().includes('verify mobile')) {
          await submitBusinessContactDetails({ businessId: confirmed.businessId, phone });
          router.push('/register/otp-phone');
          return;
        }
        if (registered.field === 'userId' || isUserIdProblem(registered.error)) {
          sendBackToUserId(registered.error ?? 'This User ID is already taken.');
          return;
        }
        if (registered.field === 'phone' || isPhoneProblem(registered.error)) {
          sendBackToPhone(registered.error ?? 'This phone number cannot be used.');
          return;
        }
        if (registered.field === 'password' || isPasswordProblem(registered.error)) {
          sendBackToPassword(registered.error ?? 'Please choose a different password.');
          return;
        }
        setFormError(registered.error ?? 'Registration failed.');
        triggerShake();
        return;
      }

      updateRegistration({
        password: undefined,
        phoneError: undefined,
        userIdError: undefined,
        passwordError: undefined,
      });
      setAccountCreated(true);
      setSavedCredentials(phone);

      const login = await loginBusiness(phone, password);
      if (login.success && login.data) {
        setAuthToken(login.data.accessToken);
        if (login.data.refreshToken) {
          setRefreshToken(login.data.refreshToken);
        }
        setUserRole(login.data.role === 'EMP' ? 'employee' : 'business');
        setIsSuper(login.data.role === 'SUPER');
        setLoggedInEmployee(null);
        setTimeout(() => setAuthenticated(true), 1600);
      } else {
        setTimeout(() => router.replace('/login'), 1600);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to confirm GST details.';
      if (isUserIdProblem(message)) {
        sendBackToUserId(message);
        return;
      }
      if (isPhoneProblem(message)) {
        sendBackToPhone(message);
        return;
      }
      if (isPasswordProblem(message)) {
        sendBackToPassword(message);
        return;
      }
      setFormError(message);
    } finally {
      setLoading(false);
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
            <AuthHint>Enter your GST</AuthHint>
          </Reveal>
          <Reveal d={1}>
            <AuthTitle>GST No</AuthTitle>
          </Reveal>

          <Animated.View style={shakeStyle}>
            <Reveal d={2}>
              <AuthField
                label="GSTIN"
                value={gstNumber}
                onChangeText={(text) => {
                  gstCheckSeq.current += 1;
                  setGstNumber(text.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15));
                  setBusinessName('');
                  setBusinessType('');
                  setAddress('');
                  setGstVerified(false);
                  setGstStatus('idle');
                  setGstError(null);
                  setFormError(null);
                }}
                placeholder="22AAAAA0000A1Z5"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={15}
                editable={!loading}
                error={gstError}
              />
              {gstStatus === 'checking' ? (
                <Text style={styles.checkingText}>Checking GST with the server…</Text>
              ) : null}
              {gstStatus === 'verified' ? (
                <Text style={styles.verifiedText}>✓ GST verified</Text>
              ) : null}
            </Reveal>
          </Animated.View>

          {formError ? <AuthErrorText>{formError}</AuthErrorText> : null}

          {businessName ? (
            <View style={styles.resultCard}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Business Name</Text>
                <Text style={styles.resultValue}>{businessName}</Text>
              </View>
              {businessType ? (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Company Type</Text>
                  <Text style={styles.resultValue}>{businessType}</Text>
                </View>
              ) : null}
              {address ? (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Registered Address</Text>
                  <Text style={styles.resultValue}>{address}</Text>
                </View>
              ) : null}
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>GST Status</Text>
                <Text style={styles.resultStatus}>● Active</Text>
              </View>
            </View>
          ) : null}

          {accountCreated ? (
            <SuccessToast message="Your account has been created successfully" />
          ) : (
            <AuthPrimaryButton
              title={gstVerified ? 'Confirm & Continue' : 'Verify GST'}
              onPress={handleConfirmAndContinue}
              loading={loading || gstStatus === 'checking'}
              style={styles.cta}
            />
          )}

          <Reveal d={4}>
            <AuthSwitch
              prompt="Already have an account?"
              linkText="Log In"
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
  resultCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    gap: 10,
  },
  checkingText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  verifiedText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.successText,
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
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  resultStatus: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.successText,
    textAlign: 'right',
  },
  cta: {
    marginTop: 22,
  },
});
