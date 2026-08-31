import { useEffect, useMemo } from 'react';

import { useBhawStore, providerFromToggle } from '@/store/bhawStore';
import { useMatricesStore } from '@/store/matricesStore';
import type { BhawRates } from '@/utils/bhawCalculation';
import type { BhawVendor } from '@/utils/bhawApi';

export interface UseBhawRatesInput {
  /** MCX 24K rate after the business's own MCX adjustment. */
  mcxBaseRate: number;
  businessCashChange?: number;
  businessRtgsChange?: number;
  /** Server-computed bhaw, used while the feed is unreachable. */
  fallbackCashBhaw?: number;
  fallbackRtgsBhaw?: number;
}

export interface UseBhawRatesResult extends BhawRates {
  vendor: BhawVendor | null;
  vendorName: string;
  isLoaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Live cash/RTGS rates for the provider selected in Dashboard Settings.
 *
 * Polls the bhaw feed while the calling screen is mounted and keeps the
 * provider in step with the `bhaw_source_jmd` toggle, so Home and Gold Rate
 * Settings always show the same numbers.
 */
export function useBhawRates(input: UseBhawRatesInput): UseBhawRatesResult {
  const {
    mcxBaseRate,
    businessCashChange = 0,
    businessRtgsChange = 0,
    fallbackCashBhaw = 0,
    fallbackRtgsBhaw = 0,
  } = input;

  const useJmd = useMatricesStore((state) => state.values.bhaw_source_jmd);
  const setProvider = useBhawStore((state) => state.setProvider);
  const vendors = useBhawStore((state) => state.vendors);
  const provider = useBhawStore((state) => state.provider);
  const isLoaded = useBhawStore((state) => state.isLoaded);
  const error = useBhawStore((state) => state.error);
  const refresh = useBhawStore((state) => state.refresh);
  const startPolling = useBhawStore((state) => state.startPolling);

  // Dashboard Settings owns the choice; mirror it into the bhaw store.
  useEffect(() => {
    setProvider(providerFromToggle(Boolean(useJmd)));
  }, [useJmd, setProvider]);

  useEffect(() => startPolling(), [startPolling]);

  return useMemo(() => {
    const vendor = vendors.find((entry) => entry.source === provider) ?? null;
    const rates = useBhawStore.getState().ratesFor({
      mcxBaseRate,
      businessCashChange,
      businessRtgsChange,
      fallbackCashBhaw,
      fallbackRtgsBhaw,
    });
    return {
      ...rates,
      vendor,
      vendorName: vendor?.name ?? (provider === 'jmd_patil' ? 'JMD Patil' : 'Mega Bullion'),
      isLoaded,
      error,
      refresh,
    };
  }, [
    vendors,
    provider,
    mcxBaseRate,
    businessCashChange,
    businessRtgsChange,
    fallbackCashBhaw,
    fallbackRtgsBhaw,
    isLoaded,
    error,
    refresh,
  ]);
}
