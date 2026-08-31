import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ChevronLeft, LogOut } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BusinessProfileBanner } from '@/components/settings/BusinessProfileBanner';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Spacing } from '@/constants/theme';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { clearPersistedAppState } from '@/utils/clearAppState';
import { useAuthStore } from '@/store/authStore';
import { getBusinessProfile, formatProfileValue } from '@/utils/businessProfile';

/** Per-item icon accent colors matching the mockup's settings menu. */
const ICON_ACCENTS: Record<string, { bg: string; color: string }> = {
  masters: { bg: Colors.diamondBg, color: Colors.diamond },
  employee: { bg: Colors.metalGoldBg, color: Colors.metalGold },
  subscription: { bg: Colors.dangerBg, color: Colors.brandDeep },
};

export default function SettingsScreen() {
  const router = useRouter();
  const registration = useAuthStore((s) => s.registration);
  const logout = useAuthStore((s) => s.logout);
  const profile = getBusinessProfile(registration);
  const { visibleMenuItems } = useSettingsAccess();

  const handleLogout = () => {
    logout();
    // Employees, inventory, purity and wishlist are persisted per
    // business, so drop them as well rather than leaking one account's
    // data into the next.
    void clearPersistedAppState();
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
                    <LogOut size={21} color={Colors.brandDeep} />
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
                  <Icon size={21} color={accent ? accent.color : Colors.textMuted} />
                </View>
                <View style={styles.menuTextWrap}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                </View>
              </>
            );

            if (item.route) {
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.9}
                  style={styles.menuCard}
                  onPress={() => router.push(item.route as Href)}
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
    marginTop: 22,
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: 14,
    shadowColor: '#15120D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  logoutTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: Colors.brandDeep,
  },
});
