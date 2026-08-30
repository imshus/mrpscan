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
  // gstError belongs to the GSTIN input; formError covers everything after it
  // (registration, login, server faults) so those never mark the GSTIN red.
  const [gstError, setGstError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  const handleVerifyGst = async () => {
    const error = validateGst(gstNumber);
    setGstError(error);
    setFormError(null);
    if (error) {
      triggerShake();
      return;
    }

    setLoading(true);
    setBusinessName('');
    setBusinessType('');
    setAddress('');
    setGstVerified(false);
    try {
      const result = await verifyBusinessGst(gstNumber);
      if (!result.success) {
        setGstError(result.error ?? 'GST verification failed');
        triggerShake();
        return;
      }

      setBusinessName(result.businessName ?? '');
      setBusinessType(result.businessType ?? '');
      setAddress(result.address ?? '');
      setGstVerified(true);
    } catch (error) {
      setGstError(error instanceof Error ? error.message : 'GST verification failed.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

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
      await handleVerifyGst();
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
        if (isUserIdProblem(registered.error)) {
          sendBackToUserId(registered.error ?? 'This User ID is already taken.');
          return;
        }
        if (isPhoneProblem(registered.error)) {
          sendBackToPhone(registered.error ?? 'This phone number cannot be used.');
          return;
        }
        if (isPasswordProblem(registered.error)) {
          sendBackToPassword(registered.error ?? 'Please choose a different password.');
          return;
        }
        setFormError(registered.error ?? 'Registration failed.');
        triggerShake();
        return;
      }

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
                  setGstNumber(text.toUpperCase());
                  setBusinessName('');
                  setBusinessType('');
                  setAddress('');
                  setGstVerified(false);
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
              loading={loading}
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
