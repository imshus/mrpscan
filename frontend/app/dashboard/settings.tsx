import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ChevronLeft, LogOut } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BusinessProfileBanner } from '@/components/settings/BusinessProfileBanner';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Spacing } from '@/constants/theme';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useAuthStore } from '@/store/authStore';
import { getBusinessProfile, formatProfileValue } from '@/utils/businessProfile';

/** Per-item icon accent colors matching the mockup's settings menu. */
const ICON_ACCENTS: Record<string, { bg: string; color: string }> = {
  masters: { bg: Colors.diamondBg, color: Colors.diamond },
  employee: { bg: Colors.metalGoldBg, color: Colors.metalGold },
  subscription: { bg: Colors.dangerBg, color: Colors.brandDeep },
  invite: { bg: Colors.metalGoldBg, color: Colors.metalGold },
  contact: { bg: Colors.diamondBg, color: Colors.diamond },
};

const ICON_SIZE = 16;

export default function SettingsScreen() {
  const router = useRouter();
  const registration = useAuthStore((s) => s.registration);
  const logout = useAuthStore((s) => s.logout);
  const profile = getBusinessProfile(registration);
  const { visibleMenuItems } = useSettingsAccess();

  const handleLogout = () => {
    // Employees, inventory, purity and wishlist are stored per account (see
    // utils/userScopedStorage.ts), so nothing needs wiping: clearing the
    // session switches the stores to the signed-out keys, and this account's
    // data is waiting under its own keys the next time it signs in.
    logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={screenStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[screenStyles.pageHeader, styles.header]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={[screenStyles.backBtn, styles.backBtn]}
          >
            <ChevronLeft size={18} color={Colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
          <Text style={[screenStyles.pageTitle, styles.headerTitle]}>Settings</Text>
        </View>
        <Pressable onPress={() => router.push('/dashboard/business-profile' as Href)}>
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
          />
        </Pressable>

        <View style={styles.menuList}>
          {visibleMenuItems.map((item) => {
            if (item.isLogout) {
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={handleLogout}
                  activeOpacity={0.9}
                  style={styles.menuCard}
                >
                  <View style={styles.logoutIconWrap}>
                    <LogOut size={ICON_SIZE} color={Colors.brandDeep} />
                  </View>
                  <Text style={styles.logoutTitle}>{item.title}</Text>
                </TouchableOpacity>
              );
            }

            const Icon = item.icon;
            const accent = ICON_ACCENTS[item.id];
            const content = (
              <>
                <View
                  style={[
                    styles.iconWrap,
                    accent ? { backgroundColor: accent.bg } : null,
                  ]}
                >
                  <Icon size={ICON_SIZE} color={accent ? accent.color : Colors.textMuted} />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                </View>
              </>
            );

            const onPress = item.route ? () => router.push(item.route as Href) : undefined;

            if (onPress) {
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.9}
                  style={styles.menuCard}
                  onPress={onPress}
                >
                  {content}
                </TouchableOpacity>
              );
            }

            return (
              <View key={item.id} style={styles.menuCard}>
                {content}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <BottomNav activeRoute="none" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  // Mockup .set-header: gap 10, margin-bottom 18 (2 + banner marginTop 16).
  header: {
    columnGap: 10,
    paddingBottom: 2,
  },
  // Mockup .rev-back-btn: 32x32 circle.
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  // Mockup .set-header-title: 1.15rem = 18.4.
  headerTitle: {
    fontSize: 18.4,
  },
  menuList: {
    paddingHorizontal: Spacing.screenHorizontal,
    marginTop: 18,
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  // Half the height the mockup's tiles had (82 → 42): a 30px icon disc with
  // 6px above and below, and the list gap tightened to match.
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    gap: 10,
    shadowColor: '#15120D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  logoutTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: Colors.brandDeep,
  },
});
