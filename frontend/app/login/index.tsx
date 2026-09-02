import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { loginBusiness } from '@/utils/authApi';

/**
 * Sign-in is by User ID only, so the value is used exactly as typed. It is
 * never reinterpreted as a phone number: a User ID made of digits belongs to
 * whoever registered it.
 */
function toLoginId(raw: string): string {
  return raw.trim();
}

export default function BusinessLoginScreen() {
  const router = useRouter();
  const {
    rememberMe,
    setAuthenticated,
    setAuthToken,
    setRefreshToken,
    setSavedCredentials,
    setUserRole,
    setIsSuper,
    setLoggedInEmployee,
    updateRegistration,
  } = useAuthStore();

  // Always start blank — never pre-fill the User ID from cached/saved data.
  // The one exception is an id handed over by Forgot User ID in this same
  // session: the user just recovered it and asked to be taken here with it, so
  // it comes from the navigation, never from storage.
  const { userId: recoveredUserId } = useLocalSearchParams<{ userId?: string }>();
  const [userId, setUserId] = useState(
    typeof recoveredUserId === 'string' ? recoveredUserId : '',
  );
  const [password, setPassword] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  const handleLogin = async () => {
    const loginId = toLoginId(userId);
    if (!loginId || !password) {
      setInvalid(true);
      triggerShake();
      return;
    }

    setLoading(true);
    console.log('[auth] Password Login');
    try {
      const result = await loginBusiness(loginId, password);
      if (!result.success || !result.data) {
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
        // Only ever the real phone number. Falling back to the login ID here
        // stored a User ID in the phone field, which then surfaced anywhere
        // the app shows the user's number.
        phone: payload.phone || '',
        userId: payload.loginId || loginId,
      });

      if (rememberMe) {
        setSavedCredentials(loginId);
      }

      console.log('[auth] Navigation Success');
      router.replace('/dashboard');
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
          <AuthBrand />

          <Animated.View style={[styles.form, shakeStyle]}>
            <Reveal d={2}>
              <AuthField
                label="User ID"
                value={userId}
                onChangeText={(text) => {
                  setUserId(text);
                  setInvalid(false);
                }}
                placeholder="Enter your User ID"
                autoCapitalize="none"
                autoCorrect={false}
                error={invalid ? '' : null}
              />
              <Pressable
                onPress={() => router.push('/login/forgot-user-id')}
                style={styles.forgotRow}
                hitSlop={6}
              >
                <Text style={styles.forgotLink}>Forgot User ID?</Text>
              </Pressable>
            </Reveal>

            <Reveal d={3}>
              <AuthField
                label="Password"
                password
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setInvalid(false);
                }}
                placeholder="••••••••"
                autoCapitalize="none"
                error={invalid ? '' : null}
              />
              <Pressable
                onPress={() => router.push('/login/forgot-password')}
                style={styles.forgotRow}
                hitSlop={6}
              >
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </Pressable>
            </Reveal>

            {invalid ? (
              <AuthErrorText center>Incorrect User ID or Password.</AuthErrorText>
            ) : null}

            <Reveal d={5}>
              <AuthPrimaryButton
                title="Log In"
                onPress={handleLogin}
                loading={loading}
                style={styles.cta}
              />
            </Reveal>
          </Animated.View>

          <Reveal d={6}>
            <AuthSwitch
              prompt="New to MRPscan?"
              linkText="Create an account"
              onPress={() => router.push('/register' as Href)}
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
    paddingTop: 64,
    paddingBottom: 40,
  },
  form: {
    gap: 16,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brandDeep,
  },
  cta: {
    marginTop: 6,
  },
});
