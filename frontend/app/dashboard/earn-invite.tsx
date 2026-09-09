import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { fetchReferralOverview, type ReferralOverview } from '@/utils/referralApi';

const INVITE_URL = 'https://mrpscan.com';

export default function EarnInviteScreen() {
  const [overview, setOverview] = useState<ReferralOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await fetchReferralOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your referral details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shareInvite = async () => {
    if (!overview) return;
    try {
      await Share.share({
        message:
          `Join me on MRPscan — photograph a jewellery tag, get the MRP, print the bill. ` +
          `Sign up with my invite code ${overview.referralCode}: ${INVITE_URL}`,
      });
    } catch {
      // Share sheet dismissed; nothing to do.
    }
  };

  const sharePurchase = async () => {
    if (!overview) return;
    try {
      await Share.share({
        message:
          `Get MRPscan for your jewellery shop — lifetime access, scan tags and bill instantly. ` +
          `Use my referral code ${overview.referralCode} when you sign up and purchase: ${INVITE_URL}`,
      });
    } catch {
      // Share sheet dismissed; nothing to do.
    }
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Earn & Invite" subtitle="Settings → Earn & Invite" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={Colors.brandDeep} />
          </View>
        ) : error ? (
          <View style={styles.statsCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity activeOpacity={0.9} style={styles.sendBtn} onPress={() => void load()}>
              <Text style={styles.sendBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : overview ? (
          <>
            <View style={styles.statsCard}>
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{overview.inviteCredits}</Text>
                <Text style={styles.statLabel}>INVITE CREDITS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{overview.purchaseCredits}</Text>
                <Text style={styles.statLabel}>PURCHASE CREDITS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValue}>{overview.totalCredits}</Text>
                <Text style={styles.statLabel}>TOTAL CREDITS</Text>
              </View>
            </View>

            <View style={styles.offerCard}>
              <Text style={styles.offerText}>
                Invite your friend & earn {overview.inviteReward} Credits
              </Text>
              <TouchableOpacity activeOpacity={0.9} style={styles.sendBtn} onPress={() => void shareInvite()}>
                <Text style={styles.sendBtnText}>Send Link</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.offerCard}>
              <Text style={styles.offerText}>
                Refer for purchase, send code and earn {overview.purchaseReward} Credits
              </Text>
              <TouchableOpacity activeOpacity={0.9} style={styles.sendBtn} onPress={() => void sharePurchase()}>
                <Text style={styles.sendBtnText}>Send Link</Text>
              </TouchableOpacity>
            </View>
          </>
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
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.tile,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.brandDeep,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  offerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.metalGoldBg,
    borderWidth: 1,
    borderColor: Colors.metalGoldBorder,
    borderRadius: Radius.tile,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  offerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 19,
  },
  sendBtn: {
    backgroundColor: Colors.brandDeep,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  sendBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  centerState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dangerText,
    lineHeight: 18,
  },
});
