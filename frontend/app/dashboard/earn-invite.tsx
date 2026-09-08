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
import { Gift, Share2 } from 'lucide-react-native';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { buildInviteMessage } from '@/constants/support';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { fetchReferralOverview, type ReferralOverview } from '@/utils/referralApi';

const HOW_IT_WORKS = [
  { step: '1', title: 'Share your code', detail: 'Send it to a jeweller who is not on MRPscan yet.' },
  { step: '2', title: 'They sign up with it', detail: 'They enter your code on the mobile-number step while registering.' },
  { step: '3', title: 'They take a licence', detail: 'The moment they start a licence, 100 credits land in your wallet.' },
];

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
      setError(err instanceof Error ? err.message : 'Could not load your referral code.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleShare = async () => {
    if (!overview) return;
    try {
      await Share.share({ message: buildInviteMessage(overview.referralCode) });
    } catch {
      // The user dismissed the share sheet; nothing to do.
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
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Gift size={22} color={Colors.metalGold} />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Refer a jeweller, earn 100 credits</Text>
            <Text style={styles.heroSub}>
              When a shop you invite starts its MRPscan licence, 100 credits are added to your
              wallet.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.brandDeep} />
          </View>
        ) : error ? (
          <View style={styles.codeCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity activeOpacity={0.9} style={styles.shareBtn} onPress={() => void load()}>
              <Text style={styles.shareBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : overview ? (
          <>
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
              <Text style={styles.codeValue}>{overview.referralCode}</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.shareBtn}
                onPress={() => void handleShare()}
              >
                <Share2 size={16} color={Colors.white} />
                <Text style={styles.shareBtnText}>Share your code</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{overview.invitedCount}</Text>
                <Text style={styles.statLabel}>Invited</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{overview.rewardedCount}</Text>
                <Text style={styles.statLabel}>Licensed</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, styles.statValueGold]}>
                  {overview.creditsEarned}
                </Text>
                <Text style={styles.statLabel}>Credits earned</Text>
              </View>
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>How it works</Text>
        <View style={screenStyles.list}>
          {HOW_IT_WORKS.map((row) => (
            <View key={row.step} style={screenStyles.listRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{row.step}</Text>
              </View>
              <View style={screenStyles.listRowText}>
                <Text style={screenStyles.listRowTitle}>{row.title}</Text>
                <Text style={screenStyles.listRowSubtitle}>{row.detail}</Text>
              </View>
            </View>
          ))}
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
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.metalGoldBg,
    borderWidth: 1,
    borderColor: Colors.metalGoldBorder,
    borderRadius: Radius.tile,
    padding: Spacing.lg,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  heroSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  loadingWrap: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },
  codeCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.tile,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.textMuted,
  },
  codeValue: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 6,
    color: Colors.textPrimary,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    alignSelf: 'stretch',
    backgroundColor: Colors.primaryButton,
    borderRadius: Radius.input,
    paddingVertical: 12,
    marginTop: Spacing.xs,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  errorText: {
    fontSize: 13,
    color: Colors.dangerText,
    textAlign: 'center',
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.marketCard,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statValueGold: {
    color: Colors.metalGold,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.diamondBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.diamond,
  },
});
