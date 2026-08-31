import { create } from 'zustand';

import {
  BHAW_POLL_INTERVAL_MS,
  BHAW_PROVIDERS,
  fetchBhawVendors,
  selectVendor,
  type BhawProvider,
  type BhawVendor,
} from '@/utils/bhawApi';
import { calculateBhawRates, type BhawRates } from '@/utils/bhawCalculation';

/**
 * Live bhaw feed shared across screens.
 *
 * Home and Gold Rate Settings both read from here, so the selected provider
 * and the rates derived from it can never disagree between screens. The
 * selected provider itself is owned by the Dashboard Settings toggle
 * (matricesStore `bhaw_source_jmd`) and pushed in via setProvider.
 */

interface BhawState {
  provider: BhawProvider;
  vendors: BhawVendor[];
  /** True once a fetch has completed, successfully or not. */
  isLoaded: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdatedAt: string | null;

  setProvider: (provider: BhawProvider) => void;
  refresh: () => Promise<void>;
  /** Polls while a screen is mounted; returns the unsubscribe. */
  startPolling: () => () => void;

  selectedVendor: () => BhawVendor | null;
  ratesFor: (input: {
    mcxBaseRate: number;
    businessCashChange?: number;
    businessRtgsChange?: number;
    fallbackCashBhaw?: number;
    fallbackRtgsBhaw?: number;
  }) => BhawRates;
}

// Module-level so concurrent screens share one timer and one in-flight request.
let pollTimer: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;
let inFlight: Promise<void> | null = null;

export const useBhawStore = create<BhawState>()((set, get) => ({
  provider: BHAW_PROVIDERS.MEGA_BULLION,
  vendors: [],
  isLoaded: false,
  isRefreshing: false,
  error: null,
  lastUpdatedAt: null,

  setProvider: (provider) => {
    if (get().provider === provider) return;
    set({ provider });
  },

  refresh: async () => {
    if (inFlight) return inFlight;
    set({ isRefreshing: true });
    inFlight = (async () => {
      try {
        const vendors = await fetchBhawVendors();
        // Keep the previous rates rather than blanking them on an empty payload.
        if (vendors.length === 0) {
          set({ error: 'Bhaw feed returned no providers', isLoaded: true });
          return;
        }
        set({
          vendors,
          error: null,
          isLoaded: true,
          lastUpdatedAt: vendors[0]?.updatedAt || null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load bhaw rates';
        set({ error: message, isLoaded: true });
      } finally {
        set({ isRefreshing: false });
        inFlight = null;
      }
    })();
    return inFlight;
  },

  startPolling: () => {
    subscribers += 1;
    void get().refresh();
    if (!pollTimer) {
      pollTimer = setInterval(() => {
        void useBhawStore.getState().refresh();
      }, BHAW_POLL_INTERVAL_MS);
    }
    return () => {
      subscribers = Math.max(0, subscribers - 1);
      if (subscribers === 0 && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  },

  selectedVendor: () => selectVendor(get().vendors, get().provider),

  ratesFor: ({
    mcxBaseRate,
    businessCashChange = 0,
    businessRtgsChange = 0,
    fallbackCashBhaw = 0,
    fallbackRtgsBhaw = 0,
  }) =>
    calculateBhawRates({
      mcxBaseRate,
      vendor: get().selectedVendor(),
      businessCashChange,
      businessRtgsChange,
      fallbackCashBhaw,
      fallbackRtgsBhaw,
    }),
}));

/** Maps the Dashboard Settings toggle onto a provider key. */
export function providerFromToggle(useJmd: boolean): BhawProvider {
  return useJmd ? BHAW_PROVIDERS.JMD_PATIL : BHAW_PROVIDERS.MEGA_BULLION;
}
