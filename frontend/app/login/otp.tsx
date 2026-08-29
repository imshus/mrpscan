import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import {
  AuthBackButton,
  AuthErrorText,
  AuthSub,
  AuthTitle,
  useShake,
} from '@/components/auth/AuthKit';
import { OtpBox } from '@/components/auth/OtpBox';
import { Reveal } from '@/components/auth/Reveal';
import { Colors } from '@/constants/theme';
import { useAndroidOtpAutofill } from '@/hooks/useAndroidOtpAutofill';
import { useAuthStore } from '@/store/authStore';
import { loginBusinessWithOtp, sendLoginOtp } from '@/utils/authApi';
import { maskPhone, validateOtp, validatePhone } from '@/utils/validation';

const OTP_LENGTH = 6;

export default function LoginOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mobile?: string }>();
  const storeMobile = useAuthStore((state) => state.registration.phone || state.savedPhone || '');
  const {
    setAuthenticated,
    setAuthToken,
    setRefreshToken,
    setUserRole,
    setIsSuper,
    setLoggedInEmployee,
    setSavedCredentials,
    rememberMe,
    updateRegistration,
  } = useAuthStore();

  const mobile = useMemo(
    () => String(params.mobile || storeMobile || '').replace(/\D/g, '').slice(0, 10),
    [params.mobile, storeMobile],
  );

  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  const applyAuthPayload = (payload: {
    accessToken: string;
    refreshToken?: string;
    role?: string;
    businessName?: string;
    gstNumber?: string;
    businessType?: string;
    address?: string;
    phone?: string;
  }) => {
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
      phone: payload.phone || mobile,
    });

    if (rememberMe) {
      setSavedCredentials(mobile);
    }
  };

  const verifyOtpAndLogin = async (otpValue: string) => {
    if (verifying) return;
    const otpValidation = validateOtp(otpValue);
    const phoneValidation = validatePhone(mobile);
    if (phoneValidation) {
      setOtpError(phoneValidation);
      return;
    }
    if (otpValidation) {
      setOtpError(otpValidation);
      return;
    }

    console.log('[auth] Auto OTP Verification Started');
    setVerifying(true);
    setOtpError(null);

    try {
      const result = await loginBusinessWithOtp(mobile, otpValue);
      if (!result.success || !result.data) {
        console.log('[auth] Auto OTP Verification Failed');
        setOtpError(result.error ?? 'Invalid OTP.');
        triggerShake();
        return;
      }

      applyAuthPayload(result.data);
      console.log('[auth] Auto OTP Verification Success');
      console.log('[auth] Navigation Success');
      router.replace('/dashboard');
    } finally {
      setVerifying(false);
    }
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

  useEffect(() => {
    if (otp.length === OTP_LENGTH) {
      verifyOtpAndLogin(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const handleOtpChange = (text: string) => {
    setOtp(text);
    setOtpError(null);
  };

  const handleResend = async () => {
    const phoneValidation = validatePhone(mobile);
    if (phoneValidation) {
      setOtpError(phoneValidation);
      return;
    }

    setResendLoading(true);
    setOtpError(null);
    try {
      const result = await sendLoginOtp(mobile);
      if (!result.success) {
        setOtpError(result.error ?? 'Failed to resend OTP.');
        return;
      }
      console.log('[auth] OTP Sent');
      setOtp('');
    } finally {
      setResendLoading(false);
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
            <AuthTitle tight>Verify OTP</AuthTitle>
          </Reveal>
          <Reveal d={1}>
            <AuthSub>
              Enter the verification code we just sent to your number {maskPhone(mobile)}.
            </AuthSub>
          </Reveal>

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
          {verifying ? <Text style={styles.verifyingText}>Verifying OTP…</Text> : null}
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
