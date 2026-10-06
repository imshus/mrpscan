import { useMemo } from 'react';

import { useBhawRates } from '@/hooks/useBhawRates';
import { useBhawStore } from '@/store/bhawStore';
import type { GoldRatesResponse } from '@/types/rates';
import {
  computeGoldRateFigures,
  goldRateBase,
  goldRateChanges,
  type GoldRateBase,
  type GoldRateChanges,
  type GoldRateFigures,
} from '@/utils/goldRateFigures';

export interface GoldRateFiguresResult {
  base: GoldRateBase | null;
  changes: GoldRateChanges | null;
  figures: GoldRateFigures | null;
  /** The house the figures stand on. */
  houseName: string;
}

/**
 * The gold figures for one server response, off the shared board feed.
 * Home and Gold Rate Settings both call this with the same response, so
 * they show the same numbers at the same moment.
 */
export function useGoldRateFigures(gold: GoldRatesResponse | undefined): GoldRateFiguresResult {
  // Keeps the followed house hydrated and the live board stream open while
  // the calling screen is in focus.
  const bhaw = useBhawRates({ mcxBaseRate: gold?.mcxLiveRate ?? 0 });
  const vendors = useBhawStore((state) => state.vendors);

  const base = useMemo(
    () => (gold ? goldRateBase(gold, vendors, bhaw.vendor) : null),
    [gold, vendors, bhaw.vendor],
  );
  const changes = useMemo(() => (gold ? goldRateChanges(gold) : null), [gold]);
  const figures = useMemo(
    () => (base && changes ? computeGoldRateFigures(base, changes) : null),
    [base, changes],
  );

  // '' is missing too: an older server sends no house, and the phone's own
  // choice names it until the server does.
  return { base, changes, figures, houseName: base?.houseName || bhaw.vendorName };
}
