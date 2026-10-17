import { useMemo } from 'react';

import type { MatrixKey } from '@/constants/dashboardMatrices';
import { useGoldRateFigures } from '@/hooks/useGoldRateFigures';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useGetGoldRatesQuery } from '@/store/goldRatesApi';
import type { GoldRate } from '@/types/rates';
import { karatFigure } from '@/utils/goldRateFigures';
import { formatKaratLabel } from '@/utils/goldRateUtils';

export interface TickerRate {
  key: string;
  label: string;
  /** Rupees per 10 g. */
  value: number;
}

const CARAT_ORDER = ['22Kt', '20Kt', '18Kt', '14Kt', '9Kt'];

const byCarat = (a: GoldRate, b: GoldRate) => {
  const ai = CARAT_ORDER.indexOf(a.carat);
  const bi = CARAT_ORDER.indexOf(b.carat);
  if (ai === -1 && bi === -1) return a.carat.localeCompare(b.carat);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
};

/**
 * Every gold rate, as one list for the rate dropdown on the review screen
 * (the owner's request): MCX, the 24K Retail and RTGS rates, then each
 * karat's Retail and RTGS. The same figures as Home (useGoldRateFigures on
 * the same response), so the two never disagree. All of them, not only the
 * rows switched on in Dashboard Settings (the owner asked for every rate
 * here); an employee still sees only what their price-visibility permissions
 * allow. Empty until the rates have answered.
 */
export function useGoldRateTicker(): TickerRate[] {
  const { data: gold } = useGetGoldRatesQuery();
  const { figures } = useGoldRateFigures(gold);
  const { employee, userRole } = useSettingsAccess();
  const permissions = userRole === 'employee' && employee ? employee.permissions : null;

  return useMemo(() => {
    if (!figures) return [];
    const allowed = (key: string) => permissions === null || permissions[key as MatrixKey] === true;
    const items: TickerRate[] = [];
    if (allowed('24k_mcx')) {
      if (figures.mcxFinal !== null) items.push({ key: 'mcx', label: 'MCX 24K', value: figures.mcxFinal });
      if (figures.retailFinal !== null) {
        items.push({ key: 'retail', label: 'Retail 24K', value: figures.retailFinal });
      }
      if (figures.rtgsSelected !== null) {
        items.push({ key: 'rtgs', label: 'RTGS 24K', value: figures.rtgsSelected });
      }
    }
    const rows = [...(gold?.rates ?? [])]
      .filter((rate) => !(rate.carat.toLowerCase().includes('24') || rate.purity >= 99.5))
      .sort(byCarat);
    for (const rate of rows) {
      const prefix = rate.carat.replace('Kt', 'k').toLowerCase();
      const karat = formatKaratLabel(rate.carat);
      if (allowed(`${prefix}_cash`) && figures.retailFinal !== null) {
        items.push({
          key: `${prefix}-retail`,
          label: `${karat} Retail`,
          value: karatFigure(figures.retailFinal, rate.purity),
        });
      }
      if (allowed(`${prefix}_rtgs`) && figures.rtgsSelected !== null) {
        items.push({
          key: `${prefix}-rtgs`,
          label: `${karat} RTGS`,
          value: karatFigure(figures.rtgsSelected, rate.purity),
        });
      }
    }
    return items;
  }, [figures, gold, permissions]);
}
