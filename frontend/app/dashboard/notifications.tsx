import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Crown, Gift, PartyPopper, Wallet } from 'lucide-react-native';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  fetchNotifications,
  timeAgo,
  type AppNotification,
  type NotificationKind,
} from '@/utils/notificationsApi';

const KIND_STYLE: Record<NotificationKind, { Icon: typeof Gift; bg: string; color: string }> = {
  referral_purchase: { Icon: PartyPopper, bg: Colors.metalGoldBg, color: Colors.metalGold },
  referral_invite: { Icon: Gift, bg: Colors.dangerBg, color: Colors.brandDeep },
  license_purchased: { Icon: Crown, bg: Colors.metalGoldBg, color: Colors.metalGold },
  credits_purchased: { Icon: Wallet, bg: Colors.successBg, color: Colors.successText },
  low_credit: { Icon: AlertTriangle, bg: Colors.metalGoldBg, color: Colors.metalGold },
  trial_ending: { Icon: Crown, bg: Colors.dangerBg, color: Colors.brandDeep },
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setItems(await fetchNotifications());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Notifications" />
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
          <Text style={styles.errorText}>{error}</Text>
        ) : items.length === 0 ? (
          <Text style={styles.emptyText}>Nothing yet. Rewards, purchases and reminders land here.</Text>
        ) : (
          items.map((item) => {
            const kindStyle = KIND_STYLE[item.kind] ?? KIND_STYLE.low_credit;
            const { Icon } = kindStyle;
            return (
              <View key={item.id} style={styles.card}>
                <View style={[styles.iconWrap, { backgroundColor: kindStyle.bg }]}>
                  <Icon size={16} color={kindStyle.color} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardText}>
                    {item.segments.map((seg, index) => (
                      <Text key={index} style={seg.bold ? styles.cardTextBold : undefined}>
                        {seg.text}
                      </Text>
                    ))}
                  </Text>
                  <Text style={styles.cardTime}>{timeAgo(item.at)}</Text>
                </View>
              </View>
            );
          })
        )}
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
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.tile,
    padding: Spacing.md,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardText: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 19,
  },
  cardTextBold: {
    fontWeight: '800',
    color: Colors.brandDeep,
  },
  cardTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  centerState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    color: Colors.dangerText,
    textAlign: 'center',
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
