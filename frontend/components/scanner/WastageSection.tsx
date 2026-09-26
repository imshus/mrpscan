import { useEffect, useMemo, useState } from 'react';

import {
  MetalFieldSlot,
  MetalGrid,
  MetalInput,
  MetalTile,
  MetalValueBox,
} from '@/components/scanner/ReviewCardKit';
import { SearchableSelectDropdown } from '@/components/scanner/SearchableSelectDropdown';
import { fetchWastageCodes, type WastageCode } from '@/utils/wastageCodeApi';

interface WastageSectionProps {
  /** The item code the wastage is kept against, as the server matched it. */
  code?: string;
  /** The percentage the server priced with — the item master's figure. */
  percent?: number;
  amountDisplay?: string;
  /**
   * On the review screen the percentage can be corrected for this one scan;
   * the box starts on the item's own figure and a typed value overrides it at
   * the server. The results view passes nothing here and stays read-only.
   */
  editable?: boolean;
  /** What the shop typed this scan; empty means the item's figure applies. */
  percentOverride?: string;
  onPercentChange?: (text: string) => void;
  /** The Masters → Wastage code picked for this scan, if any. */
  selectedCode?: string;
  /** A code was picked from the list: its percent fills the Wastage % box. */
  onCodeChange?: (code: string, percent: number | null) => void;
}

// The shop's wastage codes, fetched once per app session and shared by every
// scan: the list changes on the Masters screen, not between scans.
let cachedCodes: WastageCode[] | null = null;
let pendingCodes: Promise<WastageCode[]> | null = null;

function loadWastageCodes(): Promise<WastageCode[]> {
  if (cachedCodes) return Promise.resolve(cachedCodes);
  if (!pendingCodes) {
    pendingCodes = fetchWastageCodes()
      .then((rows) => {
        cachedCodes = rows;
        return rows;
      })
      .catch(() => [])
      .finally(() => {
        pendingCodes = null;
      });
  }
  return pendingCodes;
}

/** Drops the cached list, so the next scan reads the Masters list afresh. */
export function invalidateWastageCodes(): void {
  cachedCodes = null;
}

/**
 * The wastage tile (mockup `.wastage-tile`), a card of its own under Labour.
 *
 * Wastage is the metal the making consumes, charged as gold: a percentage of
 * the net weight at the 24K rate. The Wastage Code is a dropdown of the
 * shop's Masters → Wastage list, and picking one fills the Wastage % with
 * that code's figure; the box still takes a correction for a piece that is
 * an exception. Without a list the code reads as before, from the item.
 *
 * On the read-only results view an item with no wastage set shows no tile at
 * all: a row of zeroes there would read as "this piece has no wastage" when
 * it means "nobody has set one".
 */
export function WastageSection({
  code,
  percent,
  amountDisplay,
  editable = false,
  percentOverride,
  onPercentChange,
  selectedCode,
  onCodeChange,
}: WastageSectionProps) {
  const [codes, setCodes] = useState<WastageCode[]>(cachedCodes ?? []);

  useEffect(() => {
    if (!editable) return;
    let active = true;
    void loadWastageCodes().then((rows) => {
      if (active) setCodes(rows);
    });
    return () => {
      active = false;
    };
  }, [editable]);

  const options = useMemo(
    () => codes.map((row) => ({ value: row.code, label: row.code })),
    [codes],
  );

  if (!editable && (!percent || percent <= 0)) return null;

  const percentText =
    percentOverride !== undefined && percentOverride !== ''
      ? percentOverride
      : percent && percent > 0
        ? String(percent)
        : '';

  const shownCode = selectedCode || code || '—';

  return (
    <MetalTile title="Wastage" tone="wastage">
      <MetalGrid>
        {editable && options.length > 0 ? (
          <MetalFieldSlot label="Wastage Code">
            <SearchableSelectDropdown
              compact
              anchored
              value={selectedCode ?? ''}
              options={options}
              onChange={(value) => {
                const picked = codes.find((row) => row.code === value);
                onCodeChange?.(value, picked ? picked.percent : null);
              }}
              containerClassName="w-full"
            />
          </MetalFieldSlot>
        ) : (
          <MetalValueBox label="Wastage Code" value={shownCode} />
        )}
        {editable ? (
          <MetalInput
            label="Wastage %"
            value={percentText}
            onChangeText={(text) => onPercentChange?.(text.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
          />
        ) : (
          <MetalValueBox label="Wastage %" value={percent ? `${percent}%` : '—'} />
        )}
        <MetalValueBox label="Wastage Amount" value={amountDisplay || '—'} amount fullWidth />
      </MetalGrid>
    </MetalTile>
  );
}
