import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { GradientView } from '@/components/ui/GradientView';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { MpinInput, type MpinInputHandle } from '@/components/ui/MpinInput';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Gradients, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { changeMpin } from '@/utils/authApi';
import {
  MPIN_EMPLOYEE_FORGOT_MESSAGE,
  NO_MPIN_CHANGE_ERRORS,
  hasMpinChangeError,
  mpinChangeErrorField,
  mpinChangeMessage,
  validateMpinChange,
  type MpinChangeErrors,
} from '@/utils/mpinChange';
import { currentScopeGeneration } from '@/utils/userScopedStorage';

/**
 * MPIN Manager (mockup #screenMpinManager), from Settings: the signed-in
 * login changes its own four digits — the owner's, or an employee's own.
 * Current, New and Confirm, each with its eye; the first thing wrong is said
 * under its own field. "Forgot MPIN?" opens the same recovery Log In has and
 * comes back here; an employee is told to ask their owner instead, as the
 * server refuses that recovery to an employee's login. The digits live in
 * this screen's state only.
 */
export default function MpinManagerScreen() {
  const router = useRouter();
  const savedPhone = useAuthStore((s) => s.savedPhone);
  const userRole = useAuthStore((s) => s.userRole);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<MpinChangeErrors>(NO_MPIN_CHANGE_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The state flag lags a render behind the tap, so a quick second tap would
  // still see `false`; this one is set before anything is awaited.
  const savingRef = useRef(false);
  const nextRef = useRef<MpinInputHandle>(null);
  const confirmRef = useRef<MpinInputHandle>(null);

  const clearErrors = () => {
    setErrors(NO_MPIN_CHANGE_ERRORS);
    setFormError(null);
  };

  const handleForgot = () => {
    // The link stays for everyone, as in the design, but for an employee the
    // phone + code flow could only end in the server's refusal.
    if (userRole === 'employee') {
      Alert.alert('Forgot MPIN?', MPIN_EMPLOYEE_FORGOT_MESSAGE);
      return;
    }
    router.push({ pathname: '/dashboard/forgot-mpin', params: { phone: savedPhone } } as unknown as Href);
  };

  const handleSubmit = async () => {
    if (savingRef.current) return;
    setFormError(null);
    const local = validateMpinChange(current, next, confirm);
    setErrors(local);
    if (hasMpinChangeError(local)) return;

    savingRef.current = true;
    setSaving(true);
    const generation = currentScopeGeneration();
    try {
      const result = await changeMpin(current, next, confirm);
      // Signed out (or into another account) while it was on the wire: the
      // answer is not this screen's to show any more.
      if (generation !== currentScopeGeneration()) return;
      if (!result.success) {
        const field = mpinChangeErrorField(result.code);
        if (field) {
          setErrors({ ...NO_MPIN_CHANGE_ERRORS, [field]: mpinChangeMessage(result.code, result.error) });
        } else {
          setFormError(result.error);
        }
        return;
      }
      setCurrent('');
      setNext('');
      setConfirm('');
      Alert.alert('MPIN updated', undefined, [{ text: 'OK', onPress: () => router.back() }]);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <PageHeader title="MPIN Manager" />

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formCard}>
          <View style={styles.cardHead}>
            <Text style={styles.cardHeadText}>CHANGE MPIN</Text>
          </View>
          <View style={styles.cardBody}>
            <MpinInput
              label="Current MPIN"
              value={current}
              onChange={(value) => {
                setCurrent(value);
                clearErrors();
              }}
              onComplete={() => nextRef.current?.focus()}
              error={errors.current}
              maskedIcon="eye-off"
            />
            <Pressable onPress={handleForgot} hitSlop={8} style={styles.forgotLink}>
              <Text style={styles.forgotLinkText}>Forgot MPIN?</Text>
            </Pressable>
            <MpinInput
              ref={nextRef}
              label="New MPIN"
              value={next}
              onChange={(value) => {
                setNext(value);
                clearErrors();
              }}
              onComplete={() => confirmRef.current?.focus()}
              error={errors.next}
              maskedIcon="eye-off"
            />
            <MpinInput
              ref={confirmRef}
              label="Confirm New MPIN"
              value={confirm}
              onChange={(value) => {
                setConfirm(value);
                clearErrors();
              }}
              error={errors.confirm}
              maskedIcon="eye-off"
            />
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => void handleSubmit()}
          disabled={saving}
          style={saving ? styles.submitBtnDisabled : null}
        >
          <GradientView colors={Gradients.brand} borderRadius={999} style={styles.submitBtn}>
            {saving ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitText}>Update MPIN</Text>
            )}
          </GradientView>
        </TouchableOpacity>
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
      </KeyboardAwareScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
  },
  // .emp-form-card: 20 below.
  formCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  cardHead: {
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  cardHeadText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  cardBody: {
    padding: 16,
    gap: 16,
  },
  // .forgot: right-aligned, 0.82rem, 600, gold-deep, 4px into the gap above.
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brandDeep,
  },
  submitBtn: {
    height: Spacing.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 26,
    elevation: 5,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brandDeep,
    marginTop: 12,
    textAlign: 'center',
  },
});
