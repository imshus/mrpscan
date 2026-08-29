import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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
  AuthSwitch,
  AuthTitle,
  useShake,
} from '@/components/auth/AuthKit';
import { Reveal } from '@/components/auth/Reveal';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { submitBusinessContactDetails } from '@/utils/authApi';
import { validatePhone } from '@/utils/validation';

export default function ContactDetailsScreen() {
  const router = useRouter();
  const registration = useAuthStore((s) => s.registration);
  const updateRegistration = useAuthStore((s) => s.updateRegistration);

  const [phone, setPhone] = useState(registration.phone || '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  const handleContinue = async () => {
    const pErr = validatePhone(phone);
    setPhoneError(pErr);
    setFormError(null);
    if (pErr) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      if (!registration.businessId) {
        setFormError('Please verify GST details again before continuing.');
        return;
      }

      updateRegistration({ phone });
      await submitBusinessContactDetails({
        businessId: registration.businessId,
        phone,
      });
      router.push('/register/otp-phone');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send OTP.';
      if (
        message.includes('Registration session expired') ||
        message.includes('REGISTRATION_SESSION_EXPIRED') ||
        message.includes('verify GST again')
      ) {
        updateRegistration({ businessId: undefined });
        setFormError('Session expired after backend restart. Please verify GST again.');
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
            <AuthTitle tight>Get started</AuthTitle>
          </Reveal>
          <Reveal d={1}>
            <AuthSub>Enter your mobile number — we&apos;ll text you a code to verify it.</AuthSub>
          </Reveal>

          <Animated.View style={shakeStyle}>
            <Reveal d={2}>
              <AuthField
                label="Phone No."
                prefix="+91"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text.replace(/\D/g, '').slice(0, 10));
                  setPhoneError(null);
                }}
                placeholder="98765 43210"
                keyboardType="phone-pad"
                error={phoneError}
              />
            </Reveal>
          </Animated.View>

          {formError ? <AuthErrorText>{formError}</AuthErrorText> : null}

          <Reveal d={3}>
            <AuthPrimaryButton
              title="Continue"
              onPress={handleContinue}
              loading={loading}
              style={styles.cta}
            />
          </Reveal>

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
  cta: {
    marginTop: 22,
  },
});
