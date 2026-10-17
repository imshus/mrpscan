import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SuccessToast } from '@/components/auth/AuthKit';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { ErrorText } from '@/components/ui/ErrorText';
import { KeyboardAwareScrollView } from '@/components/ui/KeyboardAwareScrollView';
import { OtpInput } from '@/components/ui/OtpInput';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAndroidOtpAutofill } from '@/hooks/useAndroidOtpAutofill';
import { useAuthStore } from '@/store/authStore';
import { deleteAccount, sendAccountDeleteOtp } from '@/utils/accountApi';
import {
  ACCOUNT_DELETE_OTP_LENGTH,
  DELETE_CONFIRM_WORD,
  accountDeletionNote,
  canConfirmAccountDeletion,
  otpSentLine,
} from '@/utils/accountDeletion';
import { REMEMBERED_PHONE_KEY } from '@/utils/clearAppState';

/** How long "Account deleted" stays up before Log In replaces this screen. */
const SIGN_OUT_DELAY_MS = 1500;

/**
 * Forgets on this phone a login the server has just removed, so Log In no
 * longer greets the person with a login that is gone and asks for its MPIN.
 * Done the moment the server says yes, not after "Account deleted": an app
 * swiped away in that moment must still have forgotten it. The sign-out
 * itself (the Logout tile's) waits, since it leaves this screen at once.
 * The shop's records on this phone stay under their own keys, as they do
 * after any sign-out (utils/userScopedStorage.ts).
 */
function forgetDeletedLogin(): void {
  const auth = useAuthStore.getState();
  auth.setSavedCredentials('');
  auth.setSavedEmployeePhone('');
  AsyncStorage.removeItem(REMEMBERED_PHONE_KEY).catch(() => {});
}

/**
 * Delete Account, from the tile above Logout in Settings. Owners and
 * employees alike delete only their own login: a 6-digit OTP goes by SMS to
 * the account's own phone and the server checks it, and the person types
 * DELETE as well. An owner's shop — invoices, scans, credits, licence and
 * employees — stays on the server untouched.
 *
 * Done, the screen says "Account deleted" for a moment and signs out to Log In.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const isEmployee = useAuthStore((s) => s.userRole === 'employee');

  // The line the server's answer gives ("OTP sent to +91 •••••43210"); null
  // until a code has gone, and the OTP boxes appear only then, since they
  // take focus (and the keyboard) as they mount.
  const [sentLine, setSentLine] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [otp, setOtp] = useState('');
  const [typed, setTyped] = useState('');
  // A refused code (or a failed send) is said in the OTP card; anything
  // else just above the button.
  const [otpError, setOtpError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const sendBusy = useRef(false);
  const deleteBusy = useRef(false);
  const signOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
      // Left before the moment was up: the login is gone all the same, so
      // the session ends now (the dashboard then sends this phone to Log In).
      if (signOutTimer.current) {
        clearTimeout(signOutTimer.current);
        signOutTimer.current = null;
        useAuthStore.getState().logout();
      }
    },
    [],
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  // Google's one-tap SMS read, as on Log In: it only fills the boxes — the
  // delete still waits for DELETE and the button. Not while a delete is
  // checking the code already in them.
  useAndroidOtpAutofill({
    enabled: sentLine !== null && !deleted,
    otpLength: ACCOUNT_DELETE_OTP_LENGTH,
    onCodeDetected: (detected) => {
      if (deleteBusy.current) return;
      setOtp(detected);
      setOtpError(null);
    },
    onDetectionError: () => {
      // Typing and the clipboard fill remain.
    },
  });

  // Neither while a code is being sent: the new one replaces the code being
  // checked and empties the boxes.
  const canDelete = canConfirmAccountDeletion(otp, typed) && !sending && !deleting && !deleted;

  const handleSendOtp = async () => {
    // Nor a new code while a delete is checking the last one.
    if (sendBusy.current || deleteBusy.current || secondsLeft > 0 || deleted) return;
    sendBusy.current = true;
    setSending(true);
    setOtpError(null);
    setError(null);
    try {
      const result = await sendAccountDeleteOtp();
      if (!alive.current) return;
      if (!result.success) {
        setOtpError(result.error);
        return;
      }
      setSentLine(otpSentLine(result.phoneMasked));
      setOtp('');
      setSecondsLeft(result.resendAfterSeconds);
    } finally {
      sendBusy.current = false;
      if (alive.current) setSending(false);
    }
  };

  const handleDelete = async () => {
    if (deleteBusy.current || deleted || !canConfirmAccountDeletion(otp, typed)) return;
    deleteBusy.current = true;
    setDeleting(true);
    setOtpError(null);
    setError(null);
    let done = false;
    try {
      const result = await deleteAccount(otp);
      if (result.success) {
        done = true;
        forgetDeletedLogin();
        if (!alive.current) {
          useAuthStore.getState().logout();
          return;
        }
        setDeleted(true);
        signOutTimer.current = setTimeout(() => {
          signOutTimer.current = null;
          useAuthStore.getState().logout();
          router.replace('/login');
        }, SIGN_OUT_DELAY_MS);
        return;
      }
      if (!alive.current) return;
      if (result.code?.startsWith('OTP_')) setOtpError(result.error);
      else setError(result.error);
    } finally {
      // Never released after a delete that went through: there is nothing
      // left to delete, and a second tap must not send another request.
      if (!done) deleteBusy.current = false;
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={screenStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader title="Delete Account" subtitle="Settings → Delete Account" />

        <View style={styles.body}>
          <View style={styles.warnCard}>
            <View style={styles.warnIconWrap}>
              <Trash2 size={18} color={Colors.white} />
            </View>
            <View style={styles.warnTextWrap}>
              <Text style={styles.warnTitle}>Delete your account</Text>
              <Text style={styles.warnNote}>{accountDeletionNote(isEmployee)}</Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.cardHead}>
              <Text style={styles.cardHeadText}>VERIFY WITH OTP</Text>
            </View>
            <View style={styles.cardBody}>
              {sentLine === null ? (
                <>
                  <Text style={styles.note}>
                    We will send a 6-digit OTP to your registered phone number.
                  </Text>
                  <Pressable
                    onPress={handleSendOtp}
                    disabled={sending || deleted}
                    accessibilityRole="button"
                    style={[styles.sendBtn, (sending || deleted) && styles.btnDisabled]}
                  >
                    {sending ? (
                      <ActivityIndicator color={Colors.brandDeep} />
                    ) : (
                      <Text style={styles.sendText}>Send OTP</Text>
                    )}
                  </Pressable>
                  <ErrorText message={otpError} />
                </>
              ) : (
                <>
                  <Text style={styles.sentLine}>{sentLine}</Text>
                  <OtpInput
                    value={otp}
                    onChange={(next) => {
                      setOtp(next);
                      setOtpError(null);
                    }}
                    error={otpError}
                  />
                  <Pressable
                    onPress={handleSendOtp}
                    disabled={secondsLeft > 0 || sending || deleting || deleted}
                    accessibilityRole="button"
                    style={styles.resendBtn}
                  >
                    {sending ? (
                      <ActivityIndicator color={Colors.brandDeep} />
                    ) : (
                      <Text style={secondsLeft > 0 || deleting ? styles.resendWaiting : styles.resendText}>
                        {secondsLeft > 0 ? `Resend OTP in ${secondsLeft}s` : 'Resend OTP'}
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.cardHead}>
              <Text style={styles.cardHeadText}>CONFIRM</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.label}>Type {DELETE_CONFIRM_WORD} to confirm</Text>
              <TextInput
                value={typed}
                onChangeText={(next) => {
                  setTyped(next);
                  setError(null);
                }}
                editable={!deleted}
                placeholder={DELETE_CONFIRM_WORD}
                placeholderTextColor={Colors.placeholder}
                accessibilityLabel={`Type ${DELETE_CONFIRM_WORD} to confirm`}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                importantForAutofill="no"
                style={styles.input}
              />
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {deleted ? (
            <SuccessToast message="Account deleted" />
          ) : (
            <Pressable
              onPress={handleDelete}
              disabled={!canDelete}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canDelete, busy: deleting }}
              style={[styles.deleteBtn, !canDelete && !deleting && styles.btnDisabled]}
            >
              {deleting ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Trash2 size={18} color={Colors.white} />
                  <Text style={styles.deleteText}>Delete my account</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAwareScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: Spacing.screenHorizontal,
    gap: 14,
  },
  // Settings' Delete Account tile, grown into a card: the same solid red
  // disc and red edge.
  warnCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F5C6C2',
    padding: 16,
  },
  warnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnTextWrap: {
    flex: 1,
    gap: 4,
  },
  warnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.brand,
    lineHeight: 20,
  },
  warnNote: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textPrimary,
  },
  formCard: {
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
  note: {
    fontSize: 12.5,
    lineHeight: 19,
    color: Colors.textMuted,
  },
  sentLine: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sendBtn: {
    height: 46,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.brandDeep,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.brandDeep,
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textPrimary,
  },
  errorBox: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#F5C6C2',
    padding: Spacing.md,
    borderRadius: Radius.input,
  },
  errorText: {
    color: Colors.brand,
    fontSize: 13,
    lineHeight: 18,
  },
  deleteBtn: {
    height: Spacing.buttonHeight,
    borderRadius: Radius.button,
    backgroundColor: Colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
