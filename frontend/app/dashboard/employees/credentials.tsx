import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { EmployeeInfoCard } from '@/components/employees/EmployeeInfoCard';
import { EmployeeScreenHeader } from '@/components/employees/EmployeeScreenHeader';
import { GradientView } from '@/components/ui/GradientView';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { MpinInput, type MpinInputHandle } from '@/components/ui/MpinInput';
import { ShareSheet } from '@/components/ui/ShareSheet';
import { Colors, Gradients, Spacing } from '@/constants/theme';
import { useEmployeeDraftStore } from '@/store/employeeDraftStore';
import {
  buildEmployeeLoginShareMessage,
  formatPhoneForDisplay,
  isTenDigitPhone,
  validateMpinPair,
  type MpinPairErrors,
} from '@/utils/employeeCredentials';

const NO_ERRORS: MpinPairErrors = { mpin: null, confirm: null };

/** The mockup's share glyph (#empCredShareBtn), stroked in the pill's red. */
function ShareGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path
        d="M20.5 12a8.5 8.5 0 1 1-4.1-7.3M20.5 3.5 17 7l1-4Z"
        stroke={Colors.brandDeep}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Employee Credentials (mockup #screenEmpCredentials), between Add New
 * Employee and Set Permissions: the owner sets the 4-digit MPIN the new
 * employee signs in with — phone, OTP, then this MPIN — and can share it
 * with them straight away.
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
  const [shareOpen, setShareOpen] = useState(false);
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

  const handleShare = () => {
    if (!validate()) return;
    setShareOpen(true);
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
          OTP and this MPIN — share it with them once it is set.
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

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleShare}
          style={styles.shareBtn}
          accessibilityRole="button"
          accessibilityLabel="Share login details"
        >
          <ShareGlyph />
          <Text style={styles.shareText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.9} onPress={handleContinue}>
          <GradientView colors={Gradients.brand} borderRadius={999} style={styles.continueBtn}>
            <Text style={styles.continueText}>Continue</Text>
          </GradientView>
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      <BottomNav />

      <ShareSheet
        visible={shareOpen}
        message={buildEmployeeLoginShareMessage(phone, mpin)}
        onClose={() => setShareOpen(false)}
      />
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
  // .emp-cred-share-btn: full-width 50px pill, bg-alt with a border, red label.
  shareBtn: {
    height: 50,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  shareText: {
    fontSize: 13.8,
    fontWeight: '700',
    color: Colors.brandDeep,
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
