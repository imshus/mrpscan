import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

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

const tenDigits = (value: string) => value.replace(/\D/g, '').slice(-10);

/** True when the server refused with this exact code. */
const refusedWith = (error: unknown, code: string) =>
  error instanceof ApiError &&
  typeof error.body === 'object' &&
  error.body !== null &&
  (error.body as { error?: unknown }).error === code;

/**
 * Changing the phone number and the GSTIN.
 *
 * Save Changes stays down until one of them actually differs, because there
 * is nothing to save otherwise and the GST registry should not be asked about
 * a number it already answered for. Beyond that the screen follows what each
 * change costs: a new GSTIN is looked up and the registry's answer shown
 * before it is taken, a new number is proved with a code sent to it, and only
 * then is anything written.
 */
export default function EditBusinessProfileScreen() {
  const router = useRouter();
  const { editToken } = useLocalSearchParams<{ editToken?: string }>();
  const registration = useAuthStore((s) => s.registration);
  const updateRegistration = useAuthStore((s) => s.updateRegistration);
  const original = useMemo(() => getBusinessProfile(registration), [registration]);

  const [phone, setPhone] = useState(() => tenDigits(original.phone || ''));
  const [gstNumber, setGstNumber] = useState(() => (original.gstNumber || '').toUpperCase());
  const [gst, setGst] = useState<GstPreview | null>(null);
  const [gstChecking, setGstChecking] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submitted = useRef(false);

  const originalPhone = tenDigits(original.phone || '');
  const originalGst = (original.gstNumber || '').toUpperCase();
  const phoneChanged = phone !== originalPhone;
  const gstChanged = gstNumber !== originalGst;
  const changed = phoneChanged || gstChanged;

  // Without the token from the MPIN screen there is nothing this screen can
  // save, so it never shows a form that would fail on submit.
  useEffect(() => {
    if (!editToken) router.replace('/dashboard/business-profile');
  }, [editToken, router]);

  /** Applies the change; called once the code is in, or straight away. */
  const save = async (code?: string) => {
    if (!editToken || submitted.current) return;
    submitted.current = true;
    setSaving(true);
    setError(null);
    try {
      // The code goes with every save now, whichever field changed.
      const proof = code ?? otp;
      const result = await applyProfileChanges(editToken, {
        ...(phoneChanged ? { phone } : {}),
        ...(gstChanged ? { gstNumber } : {}),
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
      setError(friendlyServerMessage(caught, 'These changes could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const start = async () => {
    if (!editToken || !changed || saving) return;
    setSaving(true);
    setError(null);
    try {
      // The registry first: a GSTIN it refuses must not leave a new phone
      // number half-applied, and the shop sees whose name it is taking.
      if (gstChanged) {
        setGstChecking(true);
        const preview = await previewGstChange(editToken, gstNumber);
        setGst(preview);
        setGstChecking(false);
      }

      // Every change is proved with a code: to the new number when that is
      // what is changing, to the account's own number otherwise.
      try {
        await sendProfilePhoneOtp(editToken, phone);
        setOtpSent(true);
        return;
      } catch (caught) {
        // A server from before this rule only sends codes for a new number
        // and refuses the same one; there, the save goes through as it did.
        if (!phoneChanged && refusedWith(caught, 'PHONE_UNCHANGED')) {
          await save();
          return;
        }
        throw caught;
      }
    } catch (caught) {
      setGstChecking(false);
      setError(friendlyServerMessage(caught, 'These changes could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <ChevronLeft size={18} color={Colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
          <View>
            <Text style={styles.title}>Edit Profile</Text>
            <Text style={styles.crumb}>Settings → Profile → Edit</Text>
          </View>
        </View>

        {/* The app's own phone field: +91 in front, digits only, and it stops
            at ten. The plain field kept the LAST ten digits, so typing into a
            full number slid the whole thing left — the first digit fell off
            and the new one landed at the end. */}
        <PhoneInput
          label="Phone No."
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            setOtpSent(false);
            setOtp('');
            setError(null);
          }}
          editable={!otpSent && !saving}
        />

        <TextField
          label="GST No."
          value={gstNumber}
          onChangeText={(text) => {
            setGstNumber(text.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15));
            setGst(null);
            setError(null);
          }}
          autoCapitalize="characters"
          editable={!otpSent && !saving}
        />

        <PrimaryButton
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={() => void start()}
          loading={saving}
          disabled={!changed}
        />
        <ErrorText message={error} />

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

        {otpSent ? (
          <Reveal d={1}>
            <OtpBox
              label={
                phoneChanged
                  ? 'Enter the 6-digit code sent to your new number'
                  : 'Enter the 6-digit code sent to your number'
              }
              value={otp}
              onChange={(value) => {
                setOtp(value);
                if (error) setError(null);
                if (value.length === 6) void save(value);
              }}
              onResend={() => void sendProfilePhoneOtp(editToken || '', phone)}
            />
          </Reveal>
        ) : null}
      </ScrollView>

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
