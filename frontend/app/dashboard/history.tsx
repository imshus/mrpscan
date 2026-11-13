import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { MasterNavList } from '@/components/dashboard/masters/MasterNavList';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import type { MasterNavItem } from '@/constants/settingsMasters';
import { screenStyles } from '@/constants/screenLayout';

const SECTIONS: MasterNavItem[] = [
  { id: 'scans', title: 'Tag scan history', subtitle: '', route: '/dashboard/history/scans' },
  { id: 'wishlist', title: 'Wishlist history', subtitle: '', route: '/dashboard/history/wishlist' },
  { id: 'checkouts', title: 'Checkout history', subtitle: '', route: '/dashboard/history/checkouts' },
];

/**
 * History, from Settings: three rows — the tags scanned at the counter, what
 * went on the wishlist, and the carts billed — drawn as the Masters page
 * draws its rows (the owner's ask: one card each, the same height). Each row
 * opens its list on a page of its own (app/dashboard/history/), where a scan
 * or a wishlist add opens the tag's details and a checkout its cart. The
 * owner sees the shop's; an employee their own (the server scopes all three).
 */
export default function HistoryScreen() {
  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="History" subtitle="Settings → History" />
      <View style={screenStyles.screenBody}>
        <MasterNavList items={SECTIONS} />
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}
