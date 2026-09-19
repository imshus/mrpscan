import { useEffect, useMemo } from 'react';

import { useBhawStore, providerFromToggle } from '@/store/bhawStore';
import { useMatricesStore } from '@/store/matricesStore';
import type { BhawRates } from '@/utils/bhawCalculation';
import { feedMcxSell, type BhawVendor } from '@/utils/bhawApi';

export interface UseBhawRatesInput {
  /**
   * MCX from the rates API, used only while the bhaw feed has not answered
   * yet: the boards' own "Gold Future MCX" is the figure the shop asked the
   * app to show, so when the feed is live it wins.
   */
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
  /** The MCX actually used: the board's own figure, or the API fallback. */
  mcxRate: number;
  mcxIsLive: boolean;
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
  const hydrateProvider = useBhawStore((state) => state.hydrateProvider);

  // The remembered choice first; the legacy two-house toggle only stands in
  // for accounts that have never picked on the new card list.
  useEffect(() => {
    void hydrateProvider().then(() => {
      const state = useBhawStore.getState();
      if (state.provider) return;
      setProvider(providerFromToggle(Boolean(useJmd)));
    });
  }, [hydrateProvider, useJmd, setProvider]);

  useEffect(() => startPolling(), [startPolling]);

  return useMemo(() => {
    const vendor = vendors.find((entry) => entry.source === provider) ?? null;
    // The board's MCX is the base for everything once the feed is live.
    const liveMcx = feedMcxSell(vendors);
    const mcxRate = liveMcx ?? mcxBaseRate;
    const rates = useBhawStore.getState().ratesFor({
      mcxBaseRate: mcxRate,
      businessCashChange,
      businessRtgsChange,
      fallbackCashBhaw,
      fallbackRtgsBhaw,
    });
    return {
      ...rates,
      vendor,
      vendorName: vendor?.name ?? (provider === 'jmd_patil' ? 'JMD Patil' : 'Mega Bullion'),
      mcxRate,
      mcxIsLive: liveMcx !== null,
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
