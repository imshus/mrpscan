import { useMemo } from 'react';

import { DEFAULT_LABOUR_CHARGE_UNITS, type LabourChargeUnit } from '@/constants/labour';

/**
 * Labour charge units — defaults to frontend constants.
 * Wire to a backend endpoint here when available.
 */
export function useLabourChargeUnits(): LabourChargeUnit[] {
  return useMemo(() => [...DEFAULT_LABOUR_CHARGE_UNITS], []);
}
