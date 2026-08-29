import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MasterNavList } from '@/components/dashboard/masters/MasterNavList';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { useMarketRatesAccess } from '@/hooks/useMarketRatesAccess';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { MASTER_RATES_ITEMS } from '@/constants/settingsMasters';
import { screenStyles } from '@/constants/screenLayout';

export default function MasterRatesScreen() {
  const access = useMarketRatesAccess();

  const visibleItems = MASTER_RATES_ITEMS.filter((item) => {
    if (item.id === 'rates-gold') return access.canEditGold;
    if (item.id === 'rates-diamond') return access.canEditDiamond;
    if (item.id === 'rates-colorstone') return access.canEditColorstone;
    if (item.id === 'rates-labour') return access.canEditLabour;
    return false;
  });

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Rates" subtitle="Settings → Masters → Rates" />
      <View style={screenStyles.screenBody}>
        <MasterNavList items={visibleItems} />
      </View>
      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}
