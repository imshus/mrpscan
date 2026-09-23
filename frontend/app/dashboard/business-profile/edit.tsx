import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react-native';

import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { OtpBox } from '@/components/auth/OtpBox';
import { Reveal } from '@/components/auth/Reveal';
import { ErrorText } from '@/components/ui/ErrorText';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { ProfileUpdatedPopup } from '@/components/settings/ProfileUpdatedPopup';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { getBusinessProfile } from '@/utils/businessProfile';
import {
  applyProfileChanges,
  previewGstChange,
  sendProfilePhoneOtp,
  type GstPreview,
} from '@/utils/profileEditApi';
import { friendlyServerMessage } from '@/utils/serverMessages';
import { ApiError } from '@/utils/apiClient';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { useAndroidOtpAutofill } from '@/hooks/useAndroidOtpAutofill';

const tenDigits = (value: string) => value.replace(/\D/g, '').slice(-10);

/** Which of the two accordion cards is open, and which change an OTP proves. */
type Section = 'phone' | 'gst';

/** True when the server refused with this exact code. */
const refusedWith = (error: unknown, code: string) =>
  error instanceof ApiError &&
  typeof error.body === 'object' &&
  error.body !== null &&
  (error.body as { error?: unknown }).error === code;

/**
 * Changing the phone number and the GSTIN — one accordion card each, per the
 * shop's design: a collapsed row with a chevron, and inside it the single
 * field, its Submit, and everything that change costs. A new GSTIN is looked
 * up and the registry's answer shown before it is taken; every change is
 * proved with a code — sent to the new number when that is what is changing,
 * to the account's own number otherwise — and only then written.
 */
export default function EditBusinessProfileScreen() {
  const router = useRouter();
  const { editToken } = useLocalSearchParams<{ editToken?: string }>();
  const registration = useAuthStore((s) => s.registration);
  const updateRegistration = useAuthStore((s) => s.updateRegistration);
  const original = useMemo(() => getBusinessProfile(registration), [registration]);

  const originalPhone = tenDigits(original.phone || '');
  const originalGst = (original.gstNumber || '').toUpperCase();

  const [open, setOpen] = useState<Section | null>(null);
  const [phone, setPhone] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [gst, setGst] = useState<GstPreview | null>(null);
  const [gstChecking, setGstChecking] = useState(false);
  const [otp, setOtp] = useState('');
  // Which card's Submit the pending code belongs to; null = no code pending.
  const [otpFor, setOtpFor] = useState<Section | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submitted = useRef(false);

  // Without the token from the MPIN screen there is nothing this screen can
  // save, so it never shows a form that would fail on submit.
  useEffect(() => {
    if (!editToken) router.replace('/dashboard/business-profile');
  }, [editToken, router]);

  /** Opens one card, closes the other, and clears whatever a flow left over. */
  const toggle = (section: Section) => {
    if (saving) return;
    setOpen((current) => (current === section ? null : section));
    setPhone('');
    setGstNumber('');
    setGst(null);
    setOtp('');
    setOtpFor(null);
    setError(null);
    submitted.current = false;
  };

  /** Writes the one field `target` names, once its code is in. */
  const save = async (code: string | undefined, target: Section) => {
    if (!editToken || submitted.current) return;
    submitted.current = true;
    setSaving(true);
    setError(null);
    try {
      const proof = code ?? otp;
      const result = await applyProfileChanges(editToken, {
        ...(target === 'phone' ? { phone } : { gstNumber }),
        ...(proof ? { otp: proof } : {}),
      });

      updateRegistration({
        phone: result.phone,
        gstNumber: result.gstNumber,
        businessName: result.businessName,
        businessType: result.businessType,
        address: result.address,
      });
      setDone(true);
    } catch (caught) {
      submitted.current = false;
      setOtp('');
      setError(friendlyServerMessage(caught, 'This change could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  /** The phone card's Submit: prove the new number with a code sent to it. */
  const submitPhone = async () => {
    if (!editToken || saving) return;
    if (phone.length !== 10) {
      setError('Enter the new 10-digit mobile number.');
      return;
    }
    if (phone === originalPhone) {
      setError('That is already the number on this account.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await sendProfilePhoneOtp(editToken, phone);
      setOtpFor('phone');
    } catch (caught) {
      setError(friendlyServerMessage(caught, 'This change could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  /** The GST card's Submit: registry first, then a code to the shop's own number. */
  const submitGst = async () => {
    if (!editToken || saving) return;
    if (gstNumber.length !== 15) {
      setError('Enter the new 15-character GST number.');
      return;
    }
    if (gstNumber === originalGst) {
      setError('That is already the GST number on this business.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // The registry first: a GSTIN it refuses must stop here, and the shop
      // sees whose name it is taking before any code is sent.
      setGstChecking(true);
      const preview = await previewGstChange(editToken, gstNumber);
      setGst(preview);
      setGstChecking(false);

      try {
        await sendProfilePhoneOtp(editToken, originalPhone);
        setOtpFor('gst');
      } catch (caught) {
        // A server from before the every-change-gets-a-code rule refuses the
        // account's own number; there, the save goes through as it did.
        if (refusedWith(caught, 'PHONE_UNCHANGED')) {
          await save('', 'gst');
          return;
        }
        throw caught;
      }
    } catch (caught) {
      setGstChecking(false);
      setError(friendlyServerMessage(caught, 'This change could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  // The code fills itself when the SMS lands, same as every other
  // verification screen.
  useAndroidOtpAutofill({
    enabled: otpFor !== null && !done,
    onCodeDetected: (detectedOtp) => {
      if (!otpFor) return;
      setOtp(detectedOtp);
      setError(null);
      void save(detectedOtp, otpFor);
    },
    onDetectionError: () => {
      // Typing and the Autofill link remain; a missed read is not an error
      // worth showing over the code entry.
    },
  });

  const renderOtp = (section: Section) =>
    otpFor === section ? (
      <Reveal d={0}>
        <OtpBox
          label={
            section === 'phone'
              ? 'Enter the 6-digit code sent to your new number'
              : 'Enter the 6-digit code sent to your number'
          }
          value={otp}
          onChange={(value) => {
            setOtp(value);
            if (error) setError(null);
            if (value.length === 6) void save(value, section);
          }}
          onResend={() =>
            void sendProfilePhoneOtp(editToken || '', section === 'phone' ? phone : originalPhone)
          }
        />
      </Reveal>
    ) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <ChevronLeft size={18} color={Colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
          <View>
            <Text style={styles.title}>Edit Profile</Text>
            <Text style={styles.crumb}>Settings → Profile → Edit</Text>
          </View>
        </View>

        {/* ——— Change Phone number ——— */}
        <View style={[styles.card, open === 'phone' && styles.cardOpen]}>
          <Pressable style={styles.cardHead} onPress={() => toggle('phone')} hitSlop={4}>
            <Text style={styles.cardTitle}>Change Phone number</Text>
            {open === 'phone' ? (
              <ChevronUp size={18} color={Colors.textSecondary} />
            ) : (
              <ChevronDown size={18} color={Colors.textSecondary} />
            )}
          </Pressable>

          {open === 'phone' ? (
            <View style={styles.cardBody}>
              <PhoneInput
                label="Enter new phone number"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  setOtp('');
                  setOtpFor(null);
                  setError(null);
                }}
                editable={otpFor === null && !saving}
              />
              {otpFor !== 'phone' ? (
                <PrimaryButton
                  title={saving ? 'Sending…' : 'Submit'}
                  onPress={() => void submitPhone()}
                  loading={saving}
                />
              ) : null}
              {open === 'phone' ? <ErrorText message={error} /> : null}
              {renderOtp('phone')}
            </View>
          ) : null}
        </View>

        {/* ——— Change GST no. ——— */}
        <View style={[styles.card, open === 'gst' && styles.cardOpen]}>
          <Pressable style={styles.cardHead} onPress={() => toggle('gst')} hitSlop={4}>
            <Text style={styles.cardTitle}>Change GST no.</Text>
            {open === 'gst' ? (
              <ChevronUp size={18} color={Colors.textSecondary} />
            ) : (
              <ChevronDown size={18} color={Colors.textSecondary} />
            )}
          </Pressable>

          {open === 'gst' ? (
            <View style={styles.cardBody}>
              <TextField
                label="Enter new GST number"
                value={gstNumber}
                onChangeText={(text) => {
                  setGstNumber(text.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15));
                  setGst(null);
                  setOtp('');
                  setOtpFor(null);
                  setError(null);
                }}
                autoCapitalize="characters"
                editable={otpFor === null && !saving}
              />
              {otpFor !== 'gst' ? (
                <PrimaryButton
                  title={saving ? (gstChecking ? 'Verifying…' : 'Sending…') : 'Submit'}
                  onPress={() => void submitGst()}
                  loading={saving}
                />
              ) : null}
              {open === 'gst' ? <ErrorText message={error} /> : null}

              {gstChecking || gst ? (
                <Reveal d={0}>
                  <Text style={styles.gstHint}>
                    {gstChecking ? 'Verifying your updated GST' : 'Your updated GST'}
                  </Text>
                  <View style={styles.resultCard}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Business Name</Text>
                      <Text style={styles.resultValue}>{gst?.businessName || '—'}</Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Registered Address</Text>
                      <Text style={styles.resultValue}>{gst?.address || '—'}</Text>
                    </View>
                    {gst?.gstStatus ? (
                      <View style={styles.resultRow}>
                        <Text style={styles.resultLabel}>GST Status</Text>
                        <Text style={styles.resultActive}>● {gst.gstStatus}</Text>
                      </View>
                    ) : null}
                  </View>
                </Reveal>
              ) : null}

              {renderOtp('gst')}
            </View>
          ) : null}
        </View>
      </KeyboardAwareScrollView>

      {done ? (
        <ProfileUpdatedPopup
          onDone={() => router.replace('/dashboard/business-profile')}
        />
      ) : null}

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.md,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { fontSize: 19, fontWeight: '800', color: Colors.textPrimary },
  crumb: { fontSize: 11.5, color: Colors.accentGold, fontWeight: '700', marginTop: 2 },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.tile,
    marginBottom: Spacing.md,
  },
  // Measured off the design: the open card's ring is a deep goldenrod.
  cardOpen: { borderColor: '#B8860B', borderWidth: 1.5 },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 15,
  },
  cardTitle: { fontSize: 14.5, fontWeight: '800', color: Colors.textPrimary },
  cardBody: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  gstHint: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 16, marginBottom: 10 },
  resultCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.tile,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: 11,
  },
  resultLabel: { fontSize: 12.5, color: Colors.textMuted },
  resultValue: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  resultActive: { fontSize: 12.5, fontWeight: '800', color: '#1B8A4B' },
});
