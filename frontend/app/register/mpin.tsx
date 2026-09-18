import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { AuthErrorText, AuthPrimaryButton, useShake } from '@/components/auth/AuthKit';
import { Reveal } from '@/components/auth/Reveal';
import { MPIN_LENGTH, MpinInput } from '@/components/ui/MpinInput';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { registerBusiness } from '@/utils/authApi';
import { prepareSignInAfterSignup } from '@/utils/authSession';

/**
 * The last step of signing up: the four digits this shop will sign in with.
 *
 * Registration happens here rather than on the GST screen, because the MPIN is
 * the credential the account is created with — there is nothing to create
 * until it exists. The shop is then signed in with the number and MPIN just
 * chosen and lands on Home, so nobody types them twice.
 */
export default function CreateMpinScreen() {
  const router = useRouter();
  const { registration, setSavedCredentials } = useAuthStore();

  const [mpin, setMpin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shakeStyle, triggerShake] = useShake();

  const phone = (registration.phone ?? '').replace(/\D/g, '').slice(-10);

  const submit = async () => {
    if (mpin.length !== MPIN_LENGTH) {
      setError('Enter a 4-digit MPIN');
      triggerShake();
      return;
    }
    if (mpin !== confirm) {
      setError("MPINs don't match");
      triggerShake();
      return;
    }
    if (!registration.businessId || phone.length !== 10) {
      setError('That registration has expired. Please start again.');
      triggerShake();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const registered = await registerBusiness({
        mobile: phone,
        mpin,
        fullName: registration.fullName,
        businessDetails: {
          businessId: registration.businessId,
          businessName: registration.businessName,
          businessType: registration.businessType,
          address: registration.address,
        },
      });

      if (!registered.success) {
        setError(registered.error ?? 'Registration failed.');
        triggerShake();
        return;
      }

      // The number is what signing in asks for from now on.
      setSavedCredentials(phone);

      const session = await prepareSignInAfterSignup(phone, { mpin });
      if (session) {
        await session.activate();
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <Reveal d={0}>
            <Text style={styles.title}>Create 4 digit MPIN</Text>
            <Text style={styles.sub}>
              These four digits are how you will sign in. Keep them to yourself.
            </Text>
          </Reveal>

          <Animated.View style={[styles.form, shakeStyle]}>
            <Reveal d={1}>
              <MpinInput
                label="Create"
                value={mpin}
                onChange={(next) => {
                  setMpin(next);
                  setError(null);
                }}
                autoFocus
              />
            </Reveal>

            <Reveal d={2}>
              <MpinInput
                label="Confirm"
                value={confirm}
                onChange={(next) => {
                  setConfirm(next);
                  setError(null);
                }}
                onComplete={() => void submit()}
              />
            </Reveal>

            {error ? <AuthErrorText center>{error}</AuthErrorText> : null}

            <Reveal d={3}>
              <AuthPrimaryButton title="Submit" onPress={() => void submit()} loading={saving} />
            </Reveal>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  sub: {
    fontSize: 13.5,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 24,
  },
  form: { gap: 18 },
});
