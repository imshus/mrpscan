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
  AuthTitle,
  useShake,
} from '@/components/auth/AuthKit';
import { Reveal } from '@/components/auth/Reveal';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { registerBusiness } from '@/utils/authApi';
import { validateConfirmPassword, validatePassword } from '@/utils/validation';

export default function CreatePasswordScreen() {
  const router = useRouter();
  const registration = useAuthStore((s) => s.registration);
  const updateRegistration = useAuthStore((s) => s.updateRegistration);
  const setSavedCredentials = useAuthStore((s) => s.setSavedCredentials);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  const handleRegister = async () => {
    const pErr = validatePassword(password);
    const cErr = validateConfirmPassword(password, confirmPassword);
    setPasswordError(pErr);
    setConfirmError(cErr);
    setFormError(null);
    if (pErr || cErr) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      if (!registration.businessId) {
        setFormError('Missing business id. Please restart registration.');
        return;
      }

      if (!registration.phone) {
        setFormError('Missing mobile number. Please restart registration.');
        return;
      }

      const result = await registerBusiness({
        mobile: registration.phone,
        password,
        userId: registration.userId,
        businessDetails: {
          businessId: registration.businessId,
          businessName: registration.businessName,
          businessType: registration.businessType,
          address: registration.address,
        },
      });

      if (result.success) {
        const phone = registration.phone ?? '';
        updateRegistration({
          password: undefined,
          phone,
          businessName: registration.businessName,
          gstNumber: registration.gstNumber,
          businessId: registration.businessId,
        });
        if (phone) {
          setSavedCredentials(phone);
        }
        router.replace('/login');
      } else {
        setFormError(result.error ?? 'Registration failed');
        triggerShake();
      }
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
            <AuthTitle tight>Create Password</AuthTitle>
          </Reveal>
          <Reveal d={1}>
            <AuthSub>Create a strong password to protect your account.</AuthSub>
          </Reveal>

          <Animated.View style={shakeStyle}>
            <Reveal d={2}>
              <AuthField
                label="Create Password"
                password
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError(null);
                }}
                placeholder="••••••••"
                autoCapitalize="none"
                autoCorrect={false}
                error={passwordError}
              />
            </Reveal>

            <Reveal d={3}>
              <AuthField
                label="Confirm Password"
                password
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setConfirmError(null);
                }}
                placeholder="••••••••"
                autoCapitalize="none"
                error={confirmError}
                containerStyle={styles.confirmField}
              />
            </Reveal>
          </Animated.View>

          {formError ? <AuthErrorText>{formError}</AuthErrorText> : null}

          <Reveal d={4}>
            <AuthPrimaryButton
              title="Confirm & Register"
              onPress={handleRegister}
              loading={loading}
              style={styles.cta}
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
  confirmField: {
    marginTop: 16,
  },
  cta: {
    marginTop: 22,
  },
});
