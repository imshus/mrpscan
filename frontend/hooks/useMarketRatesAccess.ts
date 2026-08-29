import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { useSettingsAccess } from '@/hooks/useSettingsAccess';

export function useMarketRatesAccess() {
  const { userRole, employee } = useSettingsAccess();
  
  const canEditGold = userRole === 'business' || employee?.permissions.edit_rate_gold === true;
  const canEditDiamond = userRole === 'business' || employee?.permissions.edit_rate_diamond === true;
  const canEditColorstone = userRole === 'business' || employee?.permissions.edit_rate_colorstone === true;
  const canEditLabour = userRole === 'business' || employee?.permissions.edit_rate_labour === true;
  
  const hasAnyAccess = canEditGold || canEditDiamond || canEditColorstone || canEditLabour;

  return {
    canEditGold,
    canEditDiamond,
    canEditColorstone,
    canEditLabour,
    canViewMarketRates: true,
    hasAnyAccess,
  };
}

export function useRequireMarketRatesAccess() {
  const router = useRouter();
  const access = useMarketRatesAccess();

  useEffect(() => {
    if (!access.hasAnyAccess) {
      router.replace('/dashboard/settings');
    }
  }, [access.hasAnyAccess, router]);

  return access;
}
