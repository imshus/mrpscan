import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { BusinessProfileBanner } from '@/components/settings/BusinessProfileBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { getBusinessProfile, formatProfileValue } from '@/utils/businessProfile';

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
            <DetailRow label="Name of Buisness" value={formatProfileValue(profile.businessName)} />
            <DetailRow label="GST No." value={formatProfileValue(profile.gstNumber)} />
            <DetailRow
              label="Phone No."
              value={profile.phone ? `+91 ${profile.phone}` : 'Not set'}
            />
            <DetailRow label="Company Type" value={formatProfileValue(profile.businessType)} />
            <DetailRow label="Address" value={formatProfileValue(profile.address)} multiline last />
          </View>
        </View>
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
});
