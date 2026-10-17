import { useMemo } from 'react';

import type { MatrixKey } from '@/constants/dashboardMatrices';
import { useGoldRateFigures } from '@/hooks/useGoldRateFigures';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import { useGetGoldRatesQuery } from '@/store/goldRatesApi';
import { useMatricesStore } from '@/store/matricesStore';
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
 * The gold rates Home shows, as one list for the rate ticker on the review
 * screen (the owner's request): MCX, the Retail and RTGS rates, then each
 * karat's rate. The same figures as Home (useGoldRateFigures on the same
 * response), so the two never disagree, and only what this person may see
 * there: an employee's price-visibility permissions, else the shop's
 * Dashboard Settings. Empty until the rates have answered.
 */
export function useGoldRateTicker(): TickerRate[] {
  const { data: gold } = useGetGoldRatesQuery();
  const { figures } = useGoldRateFigures(gold);
  const { employee, userRole } = useSettingsAccess();
  const globalMatrixValues = useMatricesStore((s) => s.values);
  const matrix = userRole === 'employee' && employee ? employee.permissions : globalMatrixValues;

  return useMemo(() => {
    if (!figures) return [];
    const items: TickerRate[] = [];
    if (matrix['24k_mcx' as MatrixKey] === true) {
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
      if (matrix[`${prefix}_cash` as MatrixKey] && figures.retailFinal !== null) {
        items.push({
          key: `${prefix}-retail`,
          label: `${karat} Retail`,
          value: karatFigure(figures.retailFinal, rate.purity),
        });
      }
      if (matrix[`${prefix}_rtgs` as MatrixKey] && figures.rtgsSelected !== null) {
        items.push({
          key: `${prefix}-rtgs`,
          label: `${karat} RTGS`,
          value: karatFigure(figures.rtgsSelected, rate.purity),
        });
      }
    }
    return items;
  }, [figures, gold, matrix]);
}
