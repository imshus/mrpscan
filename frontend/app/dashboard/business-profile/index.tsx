import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { BusinessProfileBanner } from '@/components/settings/BusinessProfileBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useAuthStore } from '@/store/authStore';
import { getBusinessProfile, formatProfileValue } from '@/utils/businessProfile';
import {
  fetchBusinessProfile,
  fetchEInvoiceSettings,
  updateEInvoiceSettings,
} from '@/utils/businessProfileApi';

interface DetailRowProps {
  label: string;
  value: string;
  multiline?: boolean;
  last?: boolean;
}

function DetailRow({ label, value, multiline, last }: DetailRowProps) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[styles.detailValue, multiline && styles.detailValueMultiline]}
        numberOfLines={multiline ? undefined : 1}
      >
        {value}
      </Text>
    </View>
  );
}

export default function BusinessProfileScreen() {
  const registration = useAuthStore((s) => s.registration);
  const updateRegistration = useAuthStore((s) => s.updateRegistration);
  const { isOwner } = useSettingsAccess();

  // E-invoicing (IRP) credentials, the owner's to manage. The password field
  // is entry-only: the server never returns it, only whether one is saved.
  const [eInvEnabled, setEInvEnabled] = useState(false);
  const [eInvUsername, setEInvUsername] = useState('');
  const [eInvPassword, setEInvPassword] = useState('');
  const [eInvHasPassword, setEInvHasPassword] = useState(false);
  const [eInvSaving, setEInvSaving] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    void fetchEInvoiceSettings().then((settings) => {
      if (cancelled || !settings) return;
      setEInvEnabled(settings.enabled);
      setEInvUsername(settings.username);
      setEInvHasPassword(settings.hasPassword);
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  const handleEInvoiceSave = async (nextEnabled?: boolean) => {
    if (eInvSaving) return;
    setEInvSaving(true);
    try {
      const saved = await updateEInvoiceSettings({
        ...(nextEnabled !== undefined ? { enabled: nextEnabled } : {}),
        username: eInvUsername,
        ...(eInvPassword.trim() ? { password: eInvPassword.trim() } : {}),
      });
      setEInvEnabled(saved.enabled);
      setEInvUsername(saved.username);
      setEInvHasPassword(saved.hasPassword);
      setEInvPassword('');
    } catch (error) {
      Alert.alert(
        'E-Invoicing',
        error instanceof Error ? error.message : 'Could not save e-invoice settings.',
      );
    } finally {
      setEInvSaving(false);
    }
  };

  // Read the business identity from the database on open. The cached copy from
  // login renders immediately so nothing flashes empty, and a failed request
  // leaves it in place rather than blanking the screen.
  useEffect(() => {
    let cancelled = false;
    void fetchBusinessProfile().then((fresh) => {
      if (cancelled || !fresh) return;
      updateRegistration({
        businessId: fresh.businessId,
        businessName: fresh.businessName,
        gstNumber: fresh.gstNumber,
        businessType: fresh.businessType,
        address: fresh.address,
        // Only overwrite these when the server actually knows them.
        ...(fresh.phone ? { phone: fresh.phone } : {}),
        ...(fresh.loginId ? { userId: fresh.loginId } : {}),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [updateRegistration]);

  const profile = getBusinessProfile(registration);

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={screenStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Profile" />

        <BusinessProfileBanner
          businessName={formatProfileValue(profile.businessName, 'Your Business')}
          secondaryText={
            profile.gstNumber
              ? `GSTIN ${profile.gstNumber}`
              : profile.businessType
                ? profile.businessType
                : registration.businessId
                  ? `Business ID: ${registration.businessId}`
                  : 'Registered Organization'
          }
          showChevron={false}
        />

        <View style={styles.detailsCard}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsHeaderText}>BUSINESS DETAILS</Text>
          </View>

          <View style={styles.detailsBody}>
            <DetailRow label="Name of Business" value={formatProfileValue(profile.businessName)} />
            <DetailRow label="GST No." value={formatProfileValue(profile.gstNumber)} />
            <DetailRow
              label="Phone No."
              value={profile.phone ? `+91 ${profile.phone}` : 'Not set'}
            />
            <DetailRow label="Company Type" value={formatProfileValue(profile.businessType)} />
            <DetailRow label="Address" value={formatProfileValue(profile.address)} multiline last />
          </View>
        </View>

        {isOwner ? (
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsHeaderText}>E-INVOICING (IRP)</Text>
            </View>
            <View style={styles.eInvBody}>
              <Text style={styles.eInvHelp}>
                For B2B bills, MRPscan can register the invoice with the government and print the
                signed QR. Create an API user for your GSTIN at einvoice1.gst.gov.in (API
                Registration → Through GSP) and save it here.
              </Text>
              <TextInput
                value={eInvUsername}
                onChangeText={setEInvUsername}
                placeholder="IRP API username"
                placeholderTextColor={Colors.placeholder}
                autoCapitalize="none"
                style={styles.eInvInput}
              />
              <TextInput
                value={eInvPassword}
                onChangeText={setEInvPassword}
                placeholder={eInvHasPassword ? 'Password saved — enter to replace' : 'IRP API password'}
                placeholderTextColor={Colors.placeholder}
                autoCapitalize="none"
                secureTextEntry
                style={styles.eInvInput}
              />
              <View style={styles.eInvActions}>
                <View style={styles.eInvToggleWrap}>
                  <Text style={styles.eInvToggleLabel}>Register B2B invoices</Text>
                  <Switch
                    value={eInvEnabled}
                    disabled={eInvSaving}
                    onValueChange={(next) => void handleEInvoiceSave(next)}
                    trackColor={{ false: Colors.border, true: Colors.metalGold }}
                  />
                </View>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.eInvSaveBtn, eInvSaving && styles.eInvSaveBtnDisabled]}
                  disabled={eInvSaving}
                  onPress={() => void handleEInvoiceSave()}
                >
                  {eInvSaving ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.eInvSaveText}>Save credentials</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  detailsCard: {
    marginHorizontal: Spacing.screenHorizontal,
    marginTop: 22,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  detailsHeader: {
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 9,
  },
  detailsHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  detailsBody: {
    paddingHorizontal: Spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 13,
    gap: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'right',
    lineHeight: 18,
  },
  detailValueMultiline: {
    lineHeight: 20,
  },
  eInvBody: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  eInvHelp: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  eInvInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  eInvActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: 2,
  },
  eInvToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  eInvToggleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  eInvSaveBtn: {
    minWidth: 130,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.input,
    backgroundColor: Colors.primaryButton,
  },
  eInvSaveBtnDisabled: {
    opacity: 0.5,
  },
  eInvSaveText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
});
