import { memo, useCallback, useEffect, useRef } from 'react';

import {
  MetalFieldSlot,
  MetalGrid,
  MetalInput,
  MetalTile,
  MetalValueBox,
} from '@/components/scanner/ReviewCardKit';
import { SearchableSelectDropdown } from '@/components/scanner/SearchableSelectDropdown';
import { useStoneRateFetch } from '@/hooks/useStoneRateFetch';
import { DIAMOND_SHAPE_OPTIONS } from '@/constants/stoneRateOptions';
import type { StoneKind } from '@/types/scanner';
import { buildQuality } from '@/utils/qualityUtils';
import { computeStoneAmountWithDiscount, computeStoneAmount } from '@/utils/scanPriceCalculation';
import { parseNumericLabourValue } from '@/utils/labourUtils';

export interface StoneTypeRowValues {
  weight: string;
  color: string;
  clarity: string;
  quality: string;
  rate: string;
  discountPercent?: string;
  shape?: string;
  packetCode?: string;
}

/** Row fields the reader was not sure of; each marked one asks for a check. */
export type StoneRowAttention = Partial<
  Record<'shape' | 'packetCode' | 'color' | 'clarity' | 'weight' | 'rate' | 'pieces', boolean>
>;

interface StoneTypeRowCardProps {
  title: string;
  stoneType: StoneKind;
  attention?: StoneRowAttention;
  /** Position of this row inside its stone type's entries array; echoed back through onChange. */
  entryIndex: number;
  /** Position across every stone row (diamonds first); echoed back through onRateErrorChange. */
  sequenceIndex: number;
  values: StoneTypeRowValues;
  editable?: boolean;
  // The row binds its own indices so the parent can hand every row the same
  // callback instance instead of a fresh closure per render, which is what
  // lets React.memo skip rows that did not change.
  onChange?: (
    stoneType: StoneKind,
    entryIndex: number,
    values: Partial<StoneTypeRowValues>,
    /** False when the row changed itself, e.g. a rate arriving from the table. */
    fromUser?: boolean,
  ) => void;
  onRateErrorChange?: (sequenceIndex: number, hasError: boolean) => void;
  shapeOptions?: { value: string; label?: string }[];
}

const STONE_LABELS: Record<StoneKind, { rate: string; weight: string; amount: string; discount?: string }> = {
  diamond: {
    rate: 'Diamond Rate',
    weight: 'Weight',
    amount: 'Diamond Amount',
    discount: 'Discount',
  },
  colorstone: {
    rate: 'CS Rate',
    weight: 'Weight',
    amount: 'CS Amount',
  },
};

function formatInr(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export const StoneTypeRowCard = memo(function StoneTypeRowCard({
  title,
  stoneType,
  entryIndex,
  sequenceIndex,
  values,
  attention,
  editable = false,
  onChange,
  onRateErrorChange,
  shapeOptions,
}: StoneTypeRowCardProps) {
  const labels = STONE_LABELS[stoneType];
  const emitChange = useCallback(
    (next: Partial<StoneTypeRowValues>, fromUser = true) => {
      onChange?.(stoneType, entryIndex, next, fromUser);
    },
    [onChange, stoneType, entryIndex],
  );
  const amount =
    stoneType === 'diamond'
      ? computeStoneAmountWithDiscount(values.weight, values.rate, values.discountPercent)
      : computeStoneAmount(values.weight, values.rate);
  const resolvedShape = (() => {
    const raw = values.shape?.trim() ?? '';
    if (!raw) return '';
    if (raw.toLowerCase() === 'none') return '';
    const match = shapeOptions?.find((opt) => opt.value.toLowerCase() === raw.toLowerCase());
    return match?.value ?? raw;
  })();
  const dropdownOptions = (() => {
    const rawOptions = [
      { value: '', label: 'None' },
      ...(shapeOptions ?? DIAMOND_SHAPE_OPTIONS).map((opt) => ({
        value: opt.value,
        label: opt.label ?? opt.value,
      })),
    ];
    const seen = new Set<string>();
    return rawOptions.filter((option) => {
      const normalized = option.value.trim().toLowerCase();
      const key = normalized === 'none' ? '' : normalized;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();
  // Matches what the server can answer: a packet code, or colour AND clarity.
  const hasLookupCriteria =
    stoneType === 'diamond'
      ? Boolean(
          values.packetCode?.trim() ||
            (values.color.trim() && values.clarity.trim()),
        )
      : Boolean(values.color.trim() && values.clarity.trim());

  // A rate the user typed is theirs; a rate that came from the table (or from
  // the tag) is replaced by whatever the table says now, including nothing.
  const userTypedRateRef = useRef(false);

  const handleRateFetched = useCallback(
    (fetchedRate: string) => {
      // Not a user edit: the row asked the rate table and is writing down the
      // answer, so the scanned value's check mark stays until someone looks.
      if (fetchedRate) {
        emitChange({ rate: fetchedRate }, false);
        return;
      }
      if (userTypedRateRef.current || !values.rate) return;
      // The table has no row for this grade: leaving the old rate in place
      // would price the stone off a grade it no longer has.
      emitChange({ rate: '' }, false);
    },
    [emitChange, values.rate],
  );

  // Fields stay editable while a lookup runs: flipping them to read-only
  // dropped focus and the keyboard after a single character on Android.
  const { rateNotFound } = useStoneRateFetch({
    type: stoneType,
    color: values.color,
    clarity: values.clarity,
    shape: stoneType === 'diamond' ? resolvedShape : undefined,
    packetCode: stoneType === 'diamond' ? values.packetCode : undefined,
    enabled: editable && hasLookupCriteria,
    onRateFetched: handleRateFetched,
  });

  useEffect(() => {
    const rateValue = parseNumericLabourValue(values.rate) ?? 0;
    const isError = rateNotFound && rateValue <= 0;
    onRateErrorChange?.(sequenceIndex, isError);
  }, [rateNotFound, values.rate, onRateErrorChange, sequenceIndex]);

  const handleColorChange = (color: string) => {
    emitChange({ color, quality: buildQuality(color, values.clarity) });
  };

  const handleClarityChange = (clarity: string) => {
    emitChange({ clarity, quality: buildQuality(values.color, clarity) });
  };

  const handleDiscountChange = (text: string) => {
    // Keep the text as typed (one decimal point at most) rather than
    // round-tripping it through a number: String(parseFloat('5.')) is '5',
    // which ate the decimal point the moment it was pressed and made a
    // fractional discount impossible to enter. Clamp only when out of range.
    const cleaned = text.replace(/[^0-9.]/g, '');
    if (!cleaned) {
      emitChange({ discountPercent: '' });
      return;
    }
    const [integerPart = '', ...rest] = cleaned.split('.');
    const next = cleaned.includes('.') ? `${integerPart}.${rest.join('')}` : integerPart;
    if (next === '.') {
      emitChange({ discountPercent: '' });
      return;
    }
    const parsed = Number.parseFloat(next);
    if (Number.isFinite(parsed) && parsed > 100) {
      emitChange({ discountPercent: '100' });
      return;
    }
    emitChange({ discountPercent: next });
  };

  return (
    <MetalTile title={title} tone={stoneType === 'diamond' ? 'diamond' : 'plain'}>
      <MetalGrid>
        {stoneType === 'diamond' ? (
          <MetalFieldSlot label="Shape" attention={attention?.shape}>
            <SearchableSelectDropdown compact
              value={resolvedShape}
              options={dropdownOptions}
              onChange={(shape) => emitChange({ shape })}
              placeholder="None"
              containerClassName="w-full"
            />
          </MetalFieldSlot>
        ) : null}
        {stoneType === 'diamond' ? (
          <MetalInput
            label="Packet Code"
            value={values.packetCode ?? ''}
            onChangeText={(packetCode) => emitChange({ packetCode })}
            editable={editable}
            attention={attention?.packetCode}
          />
        ) : null}
        <MetalInput
          label="Color"
          value={values.color}
          onChangeText={handleColorChange}
          editable={editable}
          attention={attention?.color}
        />
        <MetalInput
          label="Clarity"
          value={values.clarity}
          onChangeText={handleClarityChange}
          editable={editable}
          attention={attention?.clarity}
        />
        <MetalInput
          label={labels.weight}
          value={values.weight}
          onChangeText={(weight) => emitChange({ weight })}
          editable={editable}
          attention={attention?.weight}
        />
        <MetalInput
          label={labels.rate}
          value={values.rate}
          onChangeText={(text) => {
            userTypedRateRef.current = true;
            emitChange({ rate: text.replace(/[^0-9.]/g, '') });
          }}
          editable={editable}
          keyboardType="decimal-pad"
          attention={attention?.rate || (rateNotFound && !values.rate)}
        />
        {stoneType === 'diamond' ? (
          <MetalInput
            label={labels.discount ?? 'Discount'}
            value={values.discountPercent ?? ''}
            onChangeText={handleDiscountChange}
            editable={editable}
            keyboardType="decimal-pad"
          />
        ) : null}
        <MetalValueBox label={labels.amount} value={formatInr(amount)} amount />
      </MetalGrid>
    </MetalTile>
  );
});
