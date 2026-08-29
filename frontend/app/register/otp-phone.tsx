import { useEffect, useState } from 'react';
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
  AuthSub,
  AuthTitle,
  SuccessToast,
  useShake,
} from '@/components/auth/AuthKit';
import { OtpBox } from '@/components/auth/OtpBox';
import { Reveal } from '@/components/auth/Reveal';
import { DevOtpBanner } from '@/components/ui/DevOtpBanner';
import { Colors } from '@/constants/theme';
import { useAndroidOtpAutofill } from '@/hooks/useAndroidOtpAutofill';
import { useDevOtp } from '@/hooks/useDevOtp';
import { useAuthStore } from '@/store/authStore';
import {
  loginBusiness,
  registerBusiness,
  submitBusinessContactDetails,
  verifyBusinessPhoneOtp,
} from '@/utils/authApi';
import { maskPhone, validateOtp } from '@/utils/validation';

const OTP_LENGTH = 6;

export default function OtpPhoneScreen() {
  const router = useRouter();
  const registration = useAuthStore((s) => s.registration);
  const {
    setAuthenticated,
    setAuthToken,
    setRefreshToken,
    setUserRole,
    setIsSuper,
    setLoggedInEmployee,
    setSavedCredentials,
  } = useAuthStore();
  const phone = registration.phone ?? '';
  const businessId = registration.businessId;

  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [devOtpRefresh, setDevOtpRefresh] = useState(0);
  const devOtp = useDevOtp(businessId, 'phone', devOtpRefresh);
  const [shakeStyle, triggerShake] = useShake();

  const handleOtpChange = (text: string) => {
    setOtp(text);
    setOtpError(null);
  };

  useAndroidOtpAutofill({
    enabled: true,
    otpLength: OTP_LENGTH,
    onCodeDetected: (detectedOtp) => {
      console.log('[auth] Auto OTP Detected');
      setOtp(detectedOtp);
    },
    onDetectionError: (message) => {
      console.log('[auth] Auto OTP Detection Failed:', message);
    },
  });

  const handleVerify = async (otpValue: string) => {
    if (verifying) return;
    const error = validateOtp(otpValue);
    setOtpError(error);
    if (error) return;

    console.log('[auth] Auto OTP Verification Started');
    setVerifying(true);
    try {
      if (!businessId) {
        setOtpError('Missing business id. Please restart registration.');
        return;
      }
      const result = await verifyBusinessPhoneOtp(businessId, otpValue);
      if (!result.success) {
        console.log('[auth] Auto OTP Verification Failed');
        setOtpError(result.error ?? 'Invalid OTP');
        triggerShake();
        return;
      }
      console.log('[auth] Auto OTP Verification Success');

      // Mockup flow: the signup form already collected the password, so finish
      // registration right here, auto-login, and land on Home with the toast.
      const password = registration.password;
      if (!password) {
        router.replace('/register/password');
        return;
      }

      const registered = await registerBusiness({
        mobile: phone,
        password,
        businessDetails: {
          businessId,
          businessName: registration.businessName,
          businessType: registration.businessType,
          address: registration.address,
        },
      });
      if (!registered.success) {
        setOtpError(registered.error ?? 'Registration failed');
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
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (otp.length === OTP_LENGTH) {
      handleVerify(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const handleResend = async () => {
    setResendLoading(true);
    try {
      if (!businessId) {
        setOtpError('Missing business id. Please restart registration.');
        return;
      }
      await submitBusinessContactDetails({ businessId, phone });
      setOtp('');
      setOtpError(null);
      setDevOtpRefresh((key) => key + 1);
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : 'Failed to resend OTP.');
    } finally {
      setResendLoading(false);
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
            <AuthTitle tight>OTP Verification</AuthTitle>
          </Reveal>
          <Reveal d={1}>
            <AuthSub>
              Enter the verification code we just sent to your number {maskPhone(phone)}.
            </AuthSub>
          </Reveal>

          {devOtp ? <DevOtpBanner label="Dev phone OTP" otp={devOtp} /> : null}

          <Animated.View style={shakeStyle}>
            <Reveal d={2}>
              <OtpBox
                value={otp}
                onChange={handleOtpChange}
                onResend={handleResend}
                resendLoading={resendLoading}
              />
            </Reveal>
          </Animated.View>

          {otpError ? <AuthErrorText>{otpError}</AuthErrorText> : null}
          {verifying && !accountCreated ? (
            <Text style={styles.verifyingText}>Verifying OTP…</Text>
          ) : null}

          {accountCreated ? (
            <SuccessToast message="Your account has been created successfully" />
          ) : null}
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
  verifyingText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 10,
    textAlign: 'center',
  },
});
