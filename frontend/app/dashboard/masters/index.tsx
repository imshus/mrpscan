import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MasterNavList } from '@/components/dashboard/masters/MasterNavList';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { useMarketRatesAccess } from '@/hooks/useMarketRatesAccess';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { MASTER_RATES_ITEMS } from '@/constants/settingsMasters';
import { screenStyles } from '@/constants/screenLayout';

export default function MastersScreen() {
  const access = useMarketRatesAccess();
  const { userRole } = useSettingsAccess();

  const visibleItems = MASTER_RATES_ITEMS.filter((item) => {
    if (item.id === 'rates-gold') return access.canEditGold;
    if (item.id === 'rates-diamond') return access.canEditDiamond;
    if (item.id === 'rates-colorstone') return access.canEditColorstone;
    if (item.id === 'rates-labour') return access.canEditLabour;
    // Wastage sits under Labour Charges and follows the same permission.
    if (item.id === 'wastage') return access.canEditLabour;
    // The item-code catalogue is the shop's to shape, so the tile is the owner's.
    if (item.id === 'item-codes') return userRole === 'business';
    // How an invoice reads is the shop's decision too: it goes to customers.
    if (item.id === 'sales-invoice') return userRole === 'business';
    // Anything without a case above is hidden rather than shown by accident —
    // which is also why a new tile must be named here, not only in the list.
    return false;
  });

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Masters" subtitle="Settings → Masters" />
      <View style={screenStyles.screenBody}>
        <MasterNavList items={visibleItems} />
      </View>
      <BottomNav />
    </SafeAreaView>
  );
}
