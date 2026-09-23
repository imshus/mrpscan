import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KeyboardAvoidingView,
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
import { MPIN_LENGTH, MpinInput } from '@/components/ui/MpinInput';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { fetchPhoneStatus, loginBusiness } from '@/utils/authApi';
import { REMEMBERED_PHONE_KEY } from '@/utils/clearAppState';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

/** Ten digits, however the number was typed or pasted. */
function toPhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(-10);
}

function maskPhone(phone: string): string {
  return phone.length === 10 ? `${phone.slice(0, 2)} ••••• ${phone.slice(-3)}` : phone;
}

export default function BusinessLoginScreen() {
  const router = useRouter();
  const {
    rememberMe,
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

  // What Forgot MPIN hands back after a reset: the number it verified and the
  // four digits just chosen. Both are filled in here so the shop lands on a
  // finished form and only has to press Log In.
  const params = useLocalSearchParams<{ phone?: string; mpin?: string }>();
  const handedBackPhone = toPhone(String(params.phone || ''));
  const handedBackMpin = String(params.mpin || '').replace(/\D/g, '').slice(0, MPIN_LENGTH);

  // The mockup's sign-in is the MPIN alone, over "Welcome back" — it assumes
  // the device knows whose shop it is. It does, once this one has signed in
  // here before. A phone that never has (or was wiped by a new build) is asked
  // for the number first, since four digits alone name nobody.
  const remembered = handedBackPhone.length === 10 ? handedBackPhone : toPhone(savedPhone || '');
  const [phone, setPhone] = useState(remembered);
  const [askForNumber, setAskForNumber] = useState(remembered.length !== 10);

  // After a new build's wipe the store starts empty, but the number itself
  // survives under its own spared key — read it back so the screen greets the
  // shop instead of asking who they are after every update.
  useEffect(() => {
    if (remembered.length === 10) return;
    let cancelled = false;
    void AsyncStorage.getItem(REMEMBERED_PHONE_KEY).then((stored: string | null) => {
      const digits = toPhone(stored || '');
      if (cancelled || digits.length !== 10) return;
      setSavedCredentials(digits);
      setPhone(digits);
      setAskForNumber(false);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mpin, setMpin] = useState(handedBackMpin);

  // Whether the number on screen has an MPIN at all. Most accounts in the
  // database were made before MPINs existed and have nothing to have
  // forgotten, so for those the link below reads "Create MPIN" and goes to
  // the set-up flow; null (unknown, unregistered, old server) keeps the
  // usual "Forgot MPIN?". Looked up a beat after the tenth digit lands, so
  // typing does not fire a request per keystroke.
  const [phoneHasMpin, setPhoneHasMpin] = useState<boolean | null>(null);
  const lookupPhone = toPhone(phone);
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
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  const handleLogin = async (submittedMpin = mpin) => {
    const loginPhone = toPhone(phone);
    if (loginPhone.length !== 10 || submittedMpin.length !== MPIN_LENGTH) {
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

      // Remembered so the next sign-in is the MPIN alone, the way the mockup
      // shows it. It is a phone number, not a credential.
      if (rememberMe) {
        setSavedCredentials(loginPhone);
      }

      router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <AuthBrand />

          <Animated.View style={[styles.form, shakeStyle]}>
            {!askForNumber ? (
              <Reveal d={1}>
                <Text style={styles.welcome}>Welcome back</Text>
                <View style={styles.knownRow}>
                  <Text style={styles.knownPhone}>+91 {maskPhone(remembered)}</Text>
                  <Pressable
                    onPress={() => {
                      setAskForNumber(true);
                      setPhone('');
                      setMpin('');
                      setInvalid(false);
                    }}
                    hitSlop={6}
                  >
                    <Text style={styles.forgotLink}>Use another number</Text>
                  </Pressable>
                </View>
              </Reveal>
            ) : (
              <Reveal d={1}>
                <AuthField
                  label="Phone No."
                  prefix="+91"
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text.replace(/\D/g, '').slice(0, 10));
                    setInvalid(false);
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoComplete="tel"
                  error={invalid ? '' : null}
                />
              </Reveal>
            )}

            <Reveal d={2}>
              <MpinInput
                label="Enter MPIN"
                value={mpin}
                onChange={(next) => {
                  setMpin(next);
                  setInvalid(false);
                }}
                autoFocus={!askForNumber}
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

            <Reveal d={4}>
              <AuthPrimaryButton
                title="Log In"
                onPress={() => void handleLogin()}
                loading={loading}
                style={styles.cta}
              />
            </Reveal>
          </Animated.View>

          <Reveal d={5}>
            <AuthSwitch
              prompt="New to MRPscan?"
              linkText="Create an account"
              onPress={() => router.push('/register' as Href)}
            />
          </Reveal>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    // Anchored to the top rather than centred: the MPIN field takes focus on
    // arrival, so the keyboard is already up, and centring in what is left of
    // the screen dropped the title and fields to the bottom of it.
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  form: { gap: 18 },
  welcome: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  knownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  knownPhone: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  forgotRow: { alignSelf: 'flex-end', marginTop: 8 },
  forgotLink: { fontSize: 13, fontWeight: '600', color: Colors.brandDeep },
  cta: { marginTop: 4 },
});
