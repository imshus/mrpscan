import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { EmployeeInfoCard } from '@/components/employees/EmployeeInfoCard';
import { EmployeeScreenHeader } from '@/components/employees/EmployeeScreenHeader';
import { GradientView } from '@/components/ui/GradientView';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { OtpInput } from '@/components/ui/OtpInput';
import { Colors, Gradients, Spacing } from '@/constants/theme';
import { useEmployeeDraftStore } from '@/store/employeeDraftStore';
import { useEmployeeStore } from '@/store/employeeStore';
import {
  EMPLOYEE_ERROR_CODES,
  sendEmployeePhoneOtp,
  updateEmployeeApi,
  verifyEmployeePhoneOtp,
} from '@/utils/employeeApi';
import {
  formatPhoneForDisplay,
  isTenDigitPhone,
  normalizeIndianPhone,
  PHONE_TAKEN_MESSAGE,
} from '@/utils/employeeCredentials';

/** Add New Employee has just sent the first code; another may follow after this. */
const FIRST_RESEND_SECONDS = 30;

/**
 * Verify Phone, at the owner's asking: the employee's own SIM proves the
 * number before it becomes their login. Add New Employee (or Edit, when the
 * number changed) sends a 6-digit OTP to it; the employee reads it out and
 * the owner types it here. The server takes the new employee, or the new
 * number, only with the token this check returns.
 *
 * Adding: on to Employee Credentials. Editing: the change is saved here and
 * the employee's page opens with the new number.
 */
export default function VerifyEmployeePhoneScreen() {
  const router = useRouter();
  const draft = useEmployeeDraftStore((s) => s.draft);
  const mode = useEmployeeDraftStore((s) => s.mode);
  const editEmployeeId = useEmployeeDraftStore((s) => s.editEmployeeId);
  const setPhoneVerification = useEmployeeDraftStore((s) => s.setPhoneVerification);
  const setTakenPhone = useEmployeeDraftStore((s) => s.setTakenPhone);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(FIRST_RESEND_SECONDS);
  const busy = useRef(false);

  const phone = normalizeIndianPhone(draft.phone);

  // The draft can be gone (an account switch resets it): no number to prove.
  useEffect(() => {
    if (!isTenDigitPhone(phone)) router.back();
  }, [phone, router]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const handleVerify = async () => {
    if (busy.current) return;
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP sent to the employee.');
      return;
    }
    busy.current = true;
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyEmployeePhoneOtp(phone, otp);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPhoneVerification({ phone, token: result.token, verifiedAt: Date.now() });

      if (mode === 'edit' && editEmployeeId) {
        const saved = await updateEmployeeApi(editEmployeeId, {
          name: draft.fullName,
          phone: draft.phone,
          email: draft.email,
          designation: draft.designation,
          phoneVerificationToken: result.token,
        });
        if (!saved.success) {
          if (saved.code === EMPLOYEE_ERROR_CODES.phoneTaken) {
            // Back on Edit, the number is marked under the field.
            setTakenPhone(phone);
            router.back();
            return;
          }
          setError(saved.error ?? 'Failed to update employee details');
          return;
        }
        updateEmployee(editEmployeeId, {
          fullName: draft.fullName,
          phone: draft.phone,
          email: draft.email,
          gender: draft.gender,
          designation: draft.designation,
        });
        // Straight to their page: Edit and this screen are done with.
        router.dismissTo(`/dashboard/employees/${editEmployeeId}` as Href);
        return;
      }

      router.replace('/dashboard/employees/credentials' as Href);
    } finally {
      busy.current = false;
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const result = await sendEmployeePhoneOtp(phone);
      if (!result.success) {
        setError(result.code === EMPLOYEE_ERROR_CODES.phoneTaken ? PHONE_TAKEN_MESSAGE : result.error);
        return;
      }
      setOtp('');
      setSecondsLeft(result.resendAfterSeconds);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <EmployeeScreenHeader title="Verify Phone" />

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.note}>
          We sent a 6-digit OTP to {formatPhoneForDisplay(phone)}. Ask the employee for it and enter it
          below.
        </Text>

        <EmployeeInfoCard
          title="EMPLOYEE PHONE"
          rows={[{ label: 'Phone No.', value: formatPhoneForDisplay(phone) }]}
        />

        <View style={styles.formCard}>
          <View style={styles.cardHead}>
            <Text style={styles.cardHeadText}>ENTER OTP</Text>
          </View>
          <View style={styles.cardBody}>
            <OtpInput
              value={otp}
              onChange={(next) => {
                setOtp(next);
                setError(null);
              }}
              error={error}
            />
            <TouchableOpacity
              onPress={handleResend}
              disabled={secondsLeft > 0 || resending}
              accessibilityRole="button"
              style={styles.resendBtn}
            >
              {resending ? (
                <ActivityIndicator color={Colors.brandDeep} />
              ) : (
                <Text style={secondsLeft > 0 ? styles.resendWaiting : styles.resendText}>
                  {secondsLeft > 0 ? `Resend OTP in ${secondsLeft}s` : 'Resend OTP'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleVerify}
          disabled={verifying}
          style={verifying ? styles.verifyBtnDisabled : null}
        >
          <GradientView colors={Gradients.brand} borderRadius={999} style={styles.verifyBtn}>
            {verifying ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.verifyText}>Verify</Text>
            )}
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
  note: {
    fontSize: 12.5,
    lineHeight: 19,
    color: Colors.textMuted,
    marginBottom: 4,
  },
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
  cardBody: {
    padding: 16,
    gap: 12,
  },
  resendBtn: {
    alignSelf: 'center',
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  resendText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.brandDeep,
  },
  resendWaiting: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  verifyBtn: {
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
  verifyBtnDisabled: {
    opacity: 0.7,
  },
  verifyText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
