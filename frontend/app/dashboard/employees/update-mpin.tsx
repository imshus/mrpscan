import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { EmployeeScreenHeader } from '@/components/employees/EmployeeScreenHeader';
import { GradientView } from '@/components/ui/GradientView';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { MpinInput, type MpinInputHandle } from '@/components/ui/MpinInput';
import { Colors, Gradients, Spacing } from '@/constants/theme';
import { validateMpinPair, type MpinPairErrors } from '@/utils/employeeCredentials';
import { updateEmployeeMpin } from '@/utils/employeeApi';

const NO_ERRORS: MpinPairErrors = { mpin: null, confirm: null };

/**
 * Update MPIN (mockup #screenEmpMpin), opened from the pencil on the
 * employee's MPIN Manager row: the owner sets new four digits and the detail
 * screen shows them on return. The digits stay in this screen's state only.
 */
export default function UpdateEmployeeMpinScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const employeeId = typeof id === 'string' ? id : '';

  const [mpin, setMpin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<MpinPairErrors>(NO_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const confirmRef = useRef<MpinInputHandle>(null);

  const handleSubmit = async () => {
    if (saving) return;
    setFormError(null);
    const next = validateMpinPair(mpin, confirm);
    setErrors(next);
    if (next.mpin || next.confirm) return;
    if (!employeeId) {
      router.back();
      return;
    }

    setSaving(true);
    try {
      const result = await updateEmployeeMpin(employeeId, mpin, confirm);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <EmployeeScreenHeader title="Update MPIN" />

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formCard}>
          <View style={styles.cardHead}>
            <Text style={styles.cardHeadText}>UPDATE MPIN FOR EMPLOYEE</Text>
          </View>
          <View style={styles.cardBody}>
            <MpinInput
              label="New MPIN"
              value={mpin}
              onChange={(next) => {
                setMpin(next);
                setErrors(NO_ERRORS);
                setFormError(null);
              }}
              onComplete={() => confirmRef.current?.focus()}
              error={errors.mpin}
              maskedIcon="eye-off"
            />
            <MpinInput
              ref={confirmRef}
              label="Confirm MPIN"
              value={confirm}
              onChange={(next) => {
                setConfirm(next);
                setErrors(NO_ERRORS);
                setFormError(null);
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
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
