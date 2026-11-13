import { memo, useEffect, useMemo, useState } from 'react';

import {
  AmountTile,
  MetalFieldSlot,
  MetalGrid,
  MetalInput,
  MetalTile,
  MetalValueBox,
} from '@/components/scanner/ReviewCardKit';
import { SearchableSelectDropdown } from '@/components/scanner/SearchableSelectDropdown';
import {
  DEFAULT_LABOUR_CHARGE_UNIT,
  DEFAULT_LABOUR_WEIGHT_BASIS,
  LABOUR_WEIGHT_OPTIONS,
  type LabourChargeUnit,
  type LabourWeightBasis,
} from '@/constants/labour';
import type { ScanItemData } from '@/types/scanner';
import { parseWeightValue } from '@/utils/formulaUtils';
import { fetchLabourCodes, type LabourCode } from '@/utils/labourCodeApi';
import { labourFromCode, usableLabourCodes } from '@/utils/labourCodes';
import { roundHalfUp } from '@/utils/moneyMath';
import { registerScopeResetCallback } from '@/utils/userScopedStorage';

export interface LaborSectionValues {
  labourPurityPercent: string;
  labourChargeAmount: string;
  labourChargeUnit: LabourChargeUnit;
  labourWeightBasis: LabourWeightBasis;
  /** The Masters → Labour Code picked for this scan; '' when none was picked. */
  labourCode: string;
}

interface LaborSectionProps {
  values: LaborSectionValues;
  onChange: (values: Partial<LaborSectionValues>) => void;
  /**
   * The Masters → Labour Code the server priced with: the one picked, else
   * the one it matched on the tag. Shown when nothing is picked.
   */
  code?: string;
  grossWeightGrams?: string;
  netWeightGrams?: string;
  /**
   * The labour the server priced into the MRP. Shown as the Labour Amount
   * whenever it is given, so the tile is the figure the MRP and the invoice
   * carry; the phone's own sum is only the fallback.
   */
  labourAmount?: number;
  pureWeightDisplay?: string;
  goldAmountDisplay?: string;
  /** The gold amount a percent labour is a share of, for the figure shown before the server's. */
  goldAmount?: number;
  /** Generate was refused and an empty Labour Rate is one of the reasons. */
  missing?: boolean;
}

function sanitizePurityInput(text: string): string {
  const digits = text.replace(/[^0-9.]/g, '');
  if (!digits) return '';
  const parsed = Number.parseFloat(digits);
  if (!Number.isFinite(parsed)) return '';
  const clamped = Math.min(100, Math.max(0, parsed));
  return `${clamped}%`;
}

function sanitizeChargeAmount(text: string): string {
  return text.replace(/[₹,%\s]/g, '');
}

/**
 * The Labour Rate box's label and prefix for the unit the figure is in: a
 * percent of the gold value (a tag's "12%", an item saved in percent, a
 * PERCENTAGE shop charge) reads as a percent, not as rupees.
 */
function rateFieldFor(unit: LabourChargeUnit): { label: string; prefix?: string } {
  if (unit === 'Percent') return { label: 'Labour (% of gold)' };
  if (unit === 'Per 10 Gram') return { label: 'Labour Rate /10g', prefix: '₹' };
  return { label: 'Labour Rate', prefix: '₹' };
}

// The shop's labour codes, fetched once per account and shared by every
// scan: the list changes on the Masters screen, not between scans. Another
// account on the same phone has its own list, and a request still out when
// the account changes (or Masters saves) must not refill the cache. The
// same arrangement as the Wastage tile's codes.
let cachedCodes: LabourCode[] | null = null;
let pendingCodes: Promise<LabourCode[]> | null = null;
let generation = 0;

/**
 * The Masters → Labour Code list, from the cache when it holds one. Never
 * rejects: a failed read is an empty list (the box then reads as before).
 */
export function loadLabourCodes(): Promise<LabourCode[]> {
  if (cachedCodes) return Promise.resolve(cachedCodes);
  if (!pendingCodes) {
    const issuedAt = generation;
    const request = fetchLabourCodes()
      .then((rows) => {
        if (issuedAt !== generation) return [];
        cachedCodes = rows;
        return rows;
      })
      .catch(() => [])
      .finally(() => {
        if (pendingCodes === request) pendingCodes = null;
      });
    pendingCodes = request;
  }
  return pendingCodes;
}

/** Drops the cached list, so the next scan reads the Masters list afresh. */
export function invalidateLabourCodes(): void {
  cachedCodes = null;
  pendingCodes = null;
  generation += 1;
}

registerScopeResetCallback(invalidateLabourCodes);

/**
 * Weight Used opens as the same popup as Gold Rate and Wastage: it floats
 * over the card under the field. It used to open inside the card and push
 * Labour Amount down, leaving an empty gap beside Labour Rate while open.
 * The Wastage tile's Weight Used is this same control.
 */
export function WeightDropdown({
  value,
  onChange,
}: {
  value: LabourWeightBasis;
  onChange: (unit: LabourWeightBasis) => void;
}) {
  return (
    <SearchableSelectDropdown
      compact
      anchored
      value={value}
      options={LABOUR_WEIGHT_OPTIONS}
      onChange={(next) => onChange(next === 'gross' ? 'gross' : 'net')}
      containerClassName="w-full"
    />
  );
}

function formatInr(amount: number): string {
  return `₹${roundHalfUp(amount).toLocaleString('en-IN')}`;
}

/**
 * The labour figure as typed: rate times the chosen weight, before the server
 * has said anything. Exported so the Final Labour Amount strip can live where
 * the screen puts it — below Wastage — while staying in step with every
 * keystroke in the tile above.
 */
export function computeFinalLabourAmount(
  values: Pick<LaborSectionValues, 'labourChargeAmount' | 'labourChargeUnit' | 'labourWeightBasis'>,
  grossWeightGrams: string,
  netWeightGrams: string,
  /** A percent labour is that share of the gold amount (the server's rule). */
  goldAmount = 0,
): number {
  if (values.labourChargeUnit === 'Percent') {
    const percent = Number(values.labourChargeAmount) || 0;
    return percent > 0 && goldAmount > 0 ? goldAmount * (percent / 100) : 0;
  }
  const grossWt = parseWeightValue(grossWeightGrams);
  const netWt = parseWeightValue(netWeightGrams);
  // Gross falls back to net when no gross weight is known, as the server does.
  const selectedWeight =
    values.labourWeightBasis === 'gross' ? (grossWt > 0 ? grossWt : netWt) : netWt;
  const rate = Number(values.labourChargeAmount) || 0;
  if (rate <= 0 || selectedWeight <= 0) return 0;
  if (values.labourChargeUnit === 'Per 10 Gram') {
    return selectedWeight * (rate / 10);
  }
  return selectedWeight * rate;
}

/** The strip itself, formatted the way the tile used to show it. */
export function FinalLabourAmountTile({
  values,
  grossWeightGrams,
  netWeightGrams,
}: {
  values: LaborSectionValues;
  grossWeightGrams: string;
  netWeightGrams: string;
}) {
  return (
    <AmountTile
      label="Final Labour Amount"
      value={formatInr(computeFinalLabourAmount(values, grossWeightGrams, netWeightGrams))}
    />
  );
}

/**
 * The Labour Charge tile (mockup `.labour-tile`), laid out as the design has
 * it: Labour Code | Weight Used, then Labour Rate | Labour Amount.
 *
 * The Labour Code is a dropdown of the shop's Masters → Labour Code list;
 * picking one puts its rate in the Labour Rate box (and the unit the rate is
 * in), and the code goes with the request so the server records it. The box
 * still takes a correction for a piece that is an exception, and a figure
 * typed there is what is charged. With no list saved the code reads as the
 * one the server matched on the tag, else '—', as on Wastage. A code kept
 * without a rate (from before Masters required one) is not offered: picking
 * it would fill nothing and record it at the box's other rate.
 */
export const LaborSection = memo(function LaborSection({
  values,
  onChange,
  code,
  grossWeightGrams = '',
  netWeightGrams = '',
  labourAmount,
  pureWeightDisplay = '—',
  goldAmountDisplay = '—',
  goldAmount = 0,
  missing = false,
}: LaborSectionProps) {
  const rateField = rateFieldFor(values.labourChargeUnit);
  const [codes, setCodes] = useState<LabourCode[]>(cachedCodes ?? []);

  useEffect(() => {
    let active = true;
    void loadLabourCodes().then((rows) => {
      if (active) setCodes(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  // Only codes with a rate to fill the box with.
  const usable = useMemo(() => usableLabourCodes(codes), [codes]);
  const options = useMemo(
    () => usable.map((row) => ({ value: row.code, label: row.code })),
    [usable],
  );

  const handleChargeChange = (text: string) => {
    const next = sanitizeChargeAmount(text);
    onChange({
      labourChargeAmount: next,
    });
  };

  // A code picked here, else the one the server matched on the tag.
  const shownCode = values.labourCode || code || '';

  return (
    <>
      <MetalTile title="Labour Charge" tone="labour">
        <MetalGrid>
          {options.length > 0 ? (
            <MetalFieldSlot label="Labour Code">
              <SearchableSelectDropdown
                compact
                anchored
                value={shownCode}
                options={options}
                onChange={(value) => {
                  // Its rate and unit fill the Labour Rate box. A code with no
                  // usable figure is never picked: it would be recorded at
                  // whatever rate the box holds.
                  const fill = labourFromCode(usable.find((row) => row.code === value));
                  if (!fill) return;
                  onChange({ labourCode: value, ...fill });
                }}
                containerClassName="w-full"
              />
            </MetalFieldSlot>
          ) : (
            <MetalValueBox label="Labour Code" value={shownCode || '—'} />
          )}
          <MetalFieldSlot label="Weight Used">
            <WeightDropdown
              value={values.labourWeightBasis}
              onChange={(labourWeightBasis) => onChange({ labourWeightBasis })}
            />
          </MetalFieldSlot>
          <MetalInput
            label={rateField.label}
            value={values.labourChargeAmount}
            onChangeText={handleChargeChange}
            keyboardType={values.labourChargeUnit === 'Percent' ? 'decimal-pad' : 'number-pad'}
            prefix={rateField.prefix}
            invalid={missing && !values.labourChargeAmount.trim()}
          />
          {/* The labour amount inside its own card, beside the rate, with
              the design's dark extra-bold amount label. */}
          <MetalValueBox
            label="Labour Amount"
            value={formatInr(
              typeof labourAmount === 'number' && Number.isFinite(labourAmount)
                ? labourAmount
                : computeFinalLabourAmount(values, grossWeightGrams, netWeightGrams, goldAmount),
            )}
            amount
          />
        </MetalGrid>
      </MetalTile>
    </>
  );
});

export function getLaborValuesFromScanData(
  scanData: Pick<
    ScanItemData,
    | 'labourPurityPercent'
    | 'labourChargeAmount'
    | 'labourChargeUnit'
    | 'labourWeightBasis'
    | 'labourCode'
  >,
): LaborSectionValues {
  return {
    labourPurityPercent: scanData.labourPurityPercent || '',
    labourChargeAmount: scanData.labourChargeAmount || '',
    labourChargeUnit: scanData.labourChargeUnit || DEFAULT_LABOUR_CHARGE_UNIT,
    labourWeightBasis: scanData.labourWeightBasis || DEFAULT_LABOUR_WEIGHT_BASIS,
    labourCode: scanData.labourCode || '',
  };
}
