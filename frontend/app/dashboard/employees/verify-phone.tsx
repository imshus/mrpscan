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
import { transferForPhone, useEmployeeDraftStore, verifiedPhoneToken } from '@/store/employeeDraftStore';
import { useEmployeeStore } from '@/store/employeeStore';
import {
  EMPLOYEE_ERROR_CODES,
  fetchEmployees,
  sendEmployeePhoneOtp,
  updateEmployeeApi,
  verifyEmployeePhoneOtp,
} from '@/utils/employeeApi';
import {
  formatPhoneForDisplay,
  isTenDigitPhone,
  normalizeIndianPhone,
  OWN_NUMBER_MESSAGE,
  PHONE_TAKEN_MESSAGE,
  phoneTransferNotice,
} from '@/utils/employeeCredentials';

/** Another code may be asked for this long after the last one was texted. */
const RESEND_AFTER_SECONDS = 30;

const secondsUntilResend = (sentAt: number | undefined): number =>
  sentAt ? Math.max(0, RESEND_AFTER_SECONDS - Math.floor((Date.now() - sentAt) / 1000)) : 0;

/**
 * Verify Phone, at the owner's asking: the employee's own SIM proves the
 * number before it becomes their login. Add New Employee (or Edit, when the
 * number changed) sends a 6-digit OTP to it; the employee reads it out and
 * the owner types it here. The server takes the new employee, or the new
 * number, only with the token this check returns.
 *
 * Adding: on to Employee Credentials. Editing: the change is saved here and
 * the employee's page opens with the new number.
 *
 * A number that is another shop's owner or employee, or another admin of
 * this shop, is moved here by the add (or the save): a line above the OTP
 * boxes says whose login it is, so the owner knows before the code is typed.
 */
export default function VerifyEmployeePhoneScreen() {
  const router = useRouter();
  const draft = useEmployeeDraftStore((s) => s.draft);
  const mode = useEmployeeDraftStore((s) => s.mode);
  const editEmployeeId = useEmployeeDraftStore((s) => s.editEmployeeId);
  const phoneVerification = useEmployeeDraftStore((s) => s.phoneVerification);
  const setPhoneVerification = useEmployeeDraftStore((s) => s.setPhoneVerification);
  const otpSent = useEmployeeDraftStore((s) => s.otpSent);
  const setOtpSent = useEmployeeDraftStore((s) => s.setOtpSent);
  const setTakenPhone = useEmployeeDraftStore((s) => s.setTakenPhone);
  const setOwnPhone = useEmployeeDraftStore((s) => s.setOwnPhone);
  const phoneTransfer = useEmployeeDraftStore((s) => s.phoneTransfer);
  const setPhoneTransfer = useEmployeeDraftStore((s) => s.setPhoneTransfer);
  const clearPhoneTransferFor = useEmployeeDraftStore((s) => s.clearPhoneTransferFor);
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee);
  const setEmployees = useEmployeeStore((s) => s.setEmployees);

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  // Counts on from when Add texted the code, so coming back here does not
  // restart the wait.
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntilResend(otpSent?.sentAt));
  const busy = useRef(false);
  // A check still running when the owner taps back must not move them on
  // from wherever they went.
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const phone = normalizeIndianPhone(draft.phone);
  // Editing: a number already proved (the save after the check failed) is
  // saved with that proof; the code itself works only once.
  const heldToken = mode === 'edit' ? verifiedPhoneToken(phoneVerification, phone) : null;
  const transfer = transferForPhone(phoneTransfer, phone);
  const transferNotice = phoneTransferNotice(transfer);

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
    if (!heldToken && otp.length !== 6) {
      setError('Enter the 6-digit OTP sent to the employee.');
      return;
    }
    busy.current = true;
    setVerifying(true);
    setError(null);
    try {
      let token = heldToken;
      if (!token) {
        const result = await verifyEmployeePhoneOtp(phone, otp);
        if (!result.success) {
          if (alive.current) setError(result.error);
          return;
        }
        token = result.token;
        setPhoneVerification({ phone, token, verifiedAt: Date.now() });
      }
      if (!alive.current) return;

      if (mode === 'edit' && editEmployeeId) {
        const saved = await updateEmployeeApi(editEmployeeId, {
          name: draft.fullName,
          phone: draft.phone,
          email: draft.email,
          designation: draft.designation,
          phoneVerificationToken: token,
          confirmTransfer: !!transfer,
        });
        if (!alive.current) return;
        if (!saved.success) {
          if (saved.code === EMPLOYEE_ERROR_CODES.ownNumber) {
            // Back on Edit, the number is marked under the field.
            setOwnPhone(phone);
            router.back();
            return;
          }
          if (saved.code === EMPLOYEE_ERROR_CODES.phoneTaken) {
            setTakenPhone(phone);
            router.back();
            return;
          }
          // A save that timed out may still have landed: look before saying
          // it failed.
          const list = await fetchEmployees();
          if (!alive.current) return;
          if (list.success && list.data) {
            setEmployees(list.data);
            const now = list.data.find((e) => e.id === editEmployeeId);
            if (now && normalizeIndianPhone(now.phone) === phone) {
              router.dismissTo(`/dashboard/employees/${editEmployeeId}` as Href);
              return;
            }
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
      if (alive.current) setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const result = await sendEmployeePhoneOtp(phone, mode === 'edit' ? editEmployeeId : null);
      if (!result.success) {
        if (
          result.code === EMPLOYEE_ERROR_CODES.ownNumber ||
          result.code === EMPLOYEE_ERROR_CODES.phoneTaken
        ) {
          // The number cannot be taken now: the line saying whose login it
          // moves goes, Add marks the field, and Continue there asks the
          // server again rather than reopening this screen on the old code.
          const own = result.code === EMPLOYEE_ERROR_CODES.ownNumber;
          clearPhoneTransferFor(phone);
          if (own) setOwnPhone(phone);
          else setTakenPhone(phone);
          setOtpSent(null);
          setError(own ? OWN_NUMBER_MESSAGE : PHONE_TAKEN_MESSAGE);
          return;
        }
        setError(result.error);
        return;
      }
      setOtpSent({ phone, sentAt: Date.now() });
      setPhoneTransfer(result.transfer ? { phone, transfer: result.transfer } : null);
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
            {transferNotice ? <Text style={styles.transferNotice}>{transferNotice}</Text> : null}
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
  transferNotice: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
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
