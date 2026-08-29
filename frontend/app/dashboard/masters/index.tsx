import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MasterNavList } from '@/components/dashboard/masters/MasterNavList';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { useMarketRatesAccess } from '@/hooks/useMarketRatesAccess';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { MASTER_SECTION_ITEMS } from '@/constants/settingsMasters';
import { screenStyles } from '@/constants/screenLayout';

export default function MastersScreen() {
  const { hasAnyAccess } = useMarketRatesAccess();
  useSettingsAccess();

  const visibleItems = MASTER_SECTION_ITEMS.filter(item => {
    if (item.id === 'section-rates') return hasAnyAccess;
    return true;
  });

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Masters" subtitle="Settings → Masters" />
      <View style={screenStyles.screenBody}>
        <MasterNavList items={visibleItems} />
      </View>
      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}
