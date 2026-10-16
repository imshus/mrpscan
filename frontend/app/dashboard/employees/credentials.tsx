import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { EmployeeInfoCard } from '@/components/employees/EmployeeInfoCard';
import { EmployeeScreenHeader } from '@/components/employees/EmployeeScreenHeader';
import { GradientView } from '@/components/ui/GradientView';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { MpinInput, type MpinInputHandle } from '@/components/ui/MpinInput';
import { Colors, Gradients, Spacing } from '@/constants/theme';
import { useEmployeeDraftStore } from '@/store/employeeDraftStore';
import {
  formatPhoneForDisplay,
  isTenDigitPhone,
  validateMpinPair,
  type MpinPairErrors,
} from '@/utils/employeeCredentials';

const NO_ERRORS: MpinPairErrors = { mpin: null, confirm: null };

/**
 * Employee Credentials (mockup #screenEmpCredentials), between Add New
 * Employee and Set Permissions: the owner sets the 4-digit MPIN the new
 * employee signs in with — phone, OTP, then this MPIN. (The Share button
 * was removed at the owner's asking, 16 Oct 2026.)
 *
 * The digits live only in the in-memory draft (never on disk): coming back
 * here from Set Permissions finds them still filled in, and the create on
 * Set Permissions sends them with everything else.
 */
export default function EmployeeCredentialsScreen() {
  const router = useRouter();
  const phone = useEmployeeDraftStore((s) => s.draft.phone);
  const mpin = useEmployeeDraftStore((s) => s.credentials.mpin);
  const confirmMpin = useEmployeeDraftStore((s) => s.credentials.confirmMpin);
  const setCredentials = useEmployeeDraftStore((s) => s.setCredentials);

  const [errors, setErrors] = useState<MpinPairErrors>(NO_ERRORS);
  const confirmRef = useRef<MpinInputHandle>(null);

  const validate = () => {
    // The draft can be gone (an account switch resets it): there is no one
    // to set an MPIN for, so back to the details.
    if (!isTenDigitPhone(phone)) {
      router.back();
      return false;
    }
    const next = validateMpinPair(mpin, confirmMpin);
    setErrors(next);
    return !next.mpin && !next.confirm;
  };

  const handleContinue = () => {
    if (!validate()) return;
    router.push('/dashboard/employees/permissions' as Href);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <EmployeeScreenHeader title="Employee Credentials" />

      {/* The keyboard-aware list alone keeps the boxes above the keyboard; a
          KeyboardAvoidingView around it would shrink the page twice. */}
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.note}>
          Create a 4-digit login MPIN for this employee. They sign in with their phone number, an
          OTP and this MPIN.
        </Text>

        <EmployeeInfoCard
          title="LOGIN DETAILS"
          rows={[{ label: 'Phone No.', value: formatPhoneForDisplay(phone) }]}
        />

        <View style={styles.formCard}>
          <View style={styles.cardHead}>
            <Text style={styles.cardHeadText}>SET MPIN</Text>
          </View>
          <View style={styles.cardBody}>
            <MpinInput
              label="Create MPIN"
              value={mpin}
              onChange={(next) => {
                setCredentials({ mpin: next });
                setErrors(NO_ERRORS);
              }}
              onComplete={() => confirmRef.current?.focus()}
              error={errors.mpin}
              maskedIcon="eye-off"
            />
            <MpinInput
              ref={confirmRef}
              label="Confirm MPIN"
              value={confirmMpin}
              onChange={(next) => {
                setCredentials({ confirmMpin: next });
                setErrors(NO_ERRORS);
              }}
              error={errors.confirm}
              maskedIcon="eye-off"
            />
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={handleContinue}>
          <GradientView colors={Gradients.brand} borderRadius={999} style={styles.continueBtn}>
            <Text style={styles.continueText}>Continue</Text>
          </GradientView>
        </TouchableOpacity>
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
  // .emp-cred-note: 0.78rem, text-dim, line-height 1.5, 16 below.
  note: {
    fontSize: 12.5,
    lineHeight: 19,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  // .emp-form-card, 14 above and below on this screen.
  formCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 14,
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
  // .emp-form-body: 16 padding, 16 between the two fields.
  cardBody: {
    padding: 16,
    gap: 16,
  },
  continueBtn: {
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
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
