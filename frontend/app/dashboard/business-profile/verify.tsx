import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { MpinInput, MPIN_LENGTH, type MpinInputHandle } from '@/components/ui/MpinInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';
import { startProfileEdit } from '@/utils/profileEditApi';
import { friendlyServerMessage } from '@/utils/serverMessages';

/**
 * The MPIN, once more, before the phone number or the GSTIN can be changed.
 *
 * Both of those are how the account is reached: the number signs the owner in
 * and carries the licence, and the GSTIN names the business on its invoices.
 * An app left unlocked on a counter should not be enough to move either, so
 * this asks for the four digits again and trades them for a short-lived token
 * the edit screen carries.
 */
export default function ConfirmMpinForProfileEdit() {
  const router = useRouter();
  const mpinRef = useRef<MpinInputHandle>(null);
  const [mpin, setMpin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const confirm = async (entered = mpin) => {
    if (entered.length !== MPIN_LENGTH || checking) return;
    setChecking(true);
    setError(null);
    try {
      const editToken = await startProfileEdit(entered);
      router.replace({
        pathname: '/dashboard/business-profile/edit',
        params: { editToken },
      } as unknown as Href);
    } catch (caught) {
      setMpin('');
      setError(friendlyServerMessage(caught, 'That MPIN is not correct.'));
      mpinRef.current?.focus();
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <ChevronLeft size={20} color={Colors.textPrimary} strokeWidth={2.2} />
        </Pressable>

        <Text style={styles.title}>Confirm MPIN</Text>
        <Text style={styles.subtitle}>
          For your security, re-enter your MPIN to edit your phone number or GST.
        </Text>

        <MpinInput
          ref={mpinRef}
          label="Enter MPIN"
          value={mpin}
          onChange={(value) => {
            setMpin(value);
            if (error) setError(null);
          }}
          // Four digits and nothing else to fill in, so it submits itself.
          onComplete={(value) => void confirm(value)}
          error={error}
          autoFocus
        />

        <PrimaryButton
          title="Confirm"
          onPress={() => void confirm()}
          loading={checking}
          disabled={mpin.length !== MPIN_LENGTH}
          style={styles.cta}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.md,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginTop: 10,
    marginBottom: 26,
  },
  cta: { marginTop: 22 },
});
