import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { EmployeeScreenHeader } from '@/components/employees/EmployeeScreenHeader';
import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients, Radius, Spacing } from '@/constants/theme';
import { otpStillLive, useEmployeeDraftStore, verifiedPhoneToken } from '@/store/employeeDraftStore';
import { useEmployeeStore } from '@/store/employeeStore';
import {
  checkEmployeePhone,
  EMPLOYEE_ERROR_CODES,
  sendEmployeePhoneOtp,
  updateEmployeeApi,
} from '@/utils/employeeApi';
import {
  normalizeIndianPhone,
  OWN_NUMBER_MESSAGE,
  PHONE_TAKEN_MESSAGE,
} from '@/utils/employeeCredentials';
import { validatePhone } from '@/utils/validation';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';

/**
 * The ten digits of a typed or pasted number. A pasted "+91 98765 43210"
 * or "098765 43210" drops its prefix; keeping the first ten digits made
 * it 9198765432, and the OTP went to a stranger.
 */
function tenDigitsOf(text: string): string {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.slice(0, 10);
}

export default function AddEmployeeScreen() {
  const router = useRouter();
  const draft = useEmployeeDraftStore((s) => s.draft);
  const updateDraft = useEmployeeDraftStore((s) => s.updateDraft);
  const mode = useEmployeeDraftStore((s) => s.mode);
  const editEmployeeId = useEmployeeDraftStore((s) => s.editEmployeeId);
  const takenPhone = useEmployeeDraftStore((s) => s.takenPhone);
  const setTakenPhone = useEmployeeDraftStore((s) => s.setTakenPhone);
  const ownPhone = useEmployeeDraftStore((s) => s.ownPhone);
  const setOwnPhone = useEmployeeDraftStore((s) => s.setOwnPhone);
  const setPhoneTransfer = useEmployeeDraftStore((s) => s.setPhoneTransfer);
  const phoneVerification = useEmployeeDraftStore((s) => s.phoneVerification);
  const otpSent = useEmployeeDraftStore((s) => s.otpSent);
  const setOtpSent = useEmployeeDraftStore((s) => s.setOtpSent);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);
  // The number the employee being edited has now: a different one is proved
  // by OTP before it is saved.
  const storedPhone = useEmployeeStore(
    (s) => s.employees.find((e) => e.id === editEmployeeId)?.phone ?? null,
  );

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // "Already registered" (and "your own number") follows the number, not the
  // visit: it shows while the field still holds the number the server
  // refused (here or on Set Permissions) and goes the moment it is changed.
  const typedPhone = normalizeIndianPhone(draft.phone);
  const phoneError =
    errors.phone ??
    (ownPhone && typedPhone === ownPhone ? OWN_NUMBER_MESSAGE : null) ??
    (takenPhone && typedPhone === takenPhone ? PHONE_TAKEN_MESSAGE : null);

  const handleContinue = async () => {
    if (saving) return;
    setFormError(null);
    const nextErrors = {
      fullName: !draft.fullName.trim() ? 'Full name is required' : null,
      phone: validatePhone(draft.phone),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    // Sends the OTP to the employee's SIM and opens Verify Phone, which
    // carries on from there (Credentials when adding; the save when editing).
    // A code texted in the last few minutes is still the one the employee
    // has: back to Add and on again opens Verify Phone without texting a
    // second code, which would make that one stop working.
    //
    // The owner's own number is refused before any code goes out; another
    // shop's owner or employee, or another admin here, gets the code like a
    // free number, and Verify Phone says whose login it moves.
    const sendOtpAndVerify = async (phone: string) => {
      if (!otpStillLive(otpSent, phone)) {
        const sent = await sendEmployeePhoneOtp(phone, mode === 'edit' ? editEmployeeId : null);
        if (!sent.success) {
          if (sent.code === EMPLOYEE_ERROR_CODES.ownNumber) {
            setPhoneTransfer(null);
            setOwnPhone(phone);
            return;
          }
          if (sent.code === EMPLOYEE_ERROR_CODES.phoneTaken) {
            setPhoneTransfer(null);
            setTakenPhone(phone);
            return;
          }
          setFormError(sent.error);
          return;
        }
        setOtpSent({ phone, sentAt: Date.now() });
        setPhoneTransfer(sent.transfer ? { phone, transfer: sent.transfer } : null);
      }
      router.push('/dashboard/employees/verify-phone' as Href);
    };

    if (mode === 'edit' && editEmployeeId) {
      const phone = normalizeIndianPhone(draft.phone);
      // A number proved a moment ago (a save that failed after the check,
      // say) is saved with that proof, without a second code.
      const token = verifiedPhoneToken(phoneVerification, phone);
      if (storedPhone && phone !== normalizeIndianPhone(storedPhone) && !token) {
        setSaving(true);
        try {
          await sendOtpAndVerify(phone);
        } finally {
          setSaving(false);
        }
        return;
      }
      setSaving(true);
      try {
        const result = await updateEmployeeApi(editEmployeeId, {
          name: draft.fullName,
          phone: draft.phone,
          email: draft.email,
          designation: draft.designation,
          ...(token ? { phoneVerificationToken: token } : {}),
        });

        if (!result.success) {
          if (result.code === EMPLOYEE_ERROR_CODES.ownNumber) {
            setErrors({ ...nextErrors, phone: OWN_NUMBER_MESSAGE });
            return;
          }
          if (result.code === EMPLOYEE_ERROR_CODES.phoneTaken) {
            setErrors({ ...nextErrors, phone: PHONE_TAKEN_MESSAGE });
            return;
          }
          if (result.code === EMPLOYEE_ERROR_CODES.phoneNotVerified) {
            // The roster on this phone had an older number: the server says
            // this one is new, so it is proved first.
            await sendOtpAndVerify(normalizeIndianPhone(draft.phone));
            return;
          }
          Alert.alert('Error', result.error ?? 'Failed to update employee details');
          return;
        }

        updateEmployee(editEmployeeId, {
          fullName: draft.fullName,
          phone: draft.phone,
          email: draft.email,
          gender: draft.gender,
          designation: draft.designation,
        });
        router.back();
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update employee');
      } finally {
        setSaving(false);
      }
      return;
    }

    // A number that can never be saved — the owner's own, an employee of
    // this shop already, a super admin's — is refused here, before the owner
    // sets an MPIN for it. Another shop's owner or employee, or another admin
    // of this shop, goes on to the OTP: the create moves that login here.
    setSaving(true);
    try {
      const phone = normalizeIndianPhone(draft.phone);
      const check = await checkEmployeePhone(phone);
      if (!check.success) {
        if (check.code === EMPLOYEE_ERROR_CODES.ownNumber) {
          setOwnPhone(phone);
          return;
        }
        setFormError(check.error);
        return;
      }
      if (!check.available) {
        setPhoneTransfer(null);
        if (check.reason === EMPLOYEE_ERROR_CODES.ownNumber) {
          setOwnPhone(phone);
        } else {
          setTakenPhone(phone);
        }
        return;
      }
      setTakenPhone(null);
      setOwnPhone(null);
      setPhoneTransfer(check.transfer ? { phone, transfer: check.transfer } : null);
      // Proved a moment ago (back from Credentials, say): no second code.
      if (verifiedPhoneToken(phoneVerification, phone)) {
        router.push('/dashboard/employees/credentials' as Href);
        return;
      }
      await sendOtpAndVerify(phone);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <EmployeeScreenHeader title={mode === 'edit' ? 'Edit Employee' : 'Add New Employee'} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.sectionTitle}>EMPLOYEE DETAILS</Text>
            </View>
            <View style={styles.cardBody}>
            <Text style={styles.label}>
              Full Name<Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              value={draft.fullName}
              onChangeText={(text) => updateDraft({ fullName: text })}
              accessibilityLabel="Full Name"
              style={[styles.input, errors.fullName ? styles.inputError : null]}
            />
            {errors.fullName ? <Text style={styles.error}>{errors.fullName}</Text> : null}

            <Text style={styles.label}>
              Phone Number<Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              value={draft.phone}
              onChangeText={(text) => updateDraft({ phone: tenDigitsOf(text) })}
              accessibilityLabel="Phone Number"
              keyboardType="phone-pad"
              style={[styles.input, phoneError ? styles.inputError : null]}
            />
            {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleContinue}
            disabled={saving}
            style={saving ? styles.continueBtnDisabled : null}
          >
            <GradientView colors={Gradients.brand} borderRadius={999} style={styles.continueBtn}>
              {saving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.continueText}>Continue</Text>
              )}
            </GradientView>
          </TouchableOpacity>
          {formError ? <Text style={[styles.error, styles.formError]}>{formError}</Text> : null}
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>

      <BottomNav />
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
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHead: {
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  cardBody: {
    padding: 16,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brandDeep,
    marginBottom: 7,
    marginTop: 14,
  },
  required: {
    color: Colors.brandDeep,
  },
  input: {
    minHeight: 50,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: 16,
    fontSize: 15,
    color: Colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputError: {
    borderColor: Colors.brandDeep,
  },
  error: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brandDeep,
    marginTop: 6,
  },
  formError: {
    marginTop: 12,
    textAlign: 'center',
  },
  continueBtn: {
    height: Spacing.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 26,
    elevation: 5,
  },
  continueBtnDisabled: {
    opacity: 0.7,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
