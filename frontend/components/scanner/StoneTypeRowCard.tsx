import { memo, useCallback, useEffect, useRef } from 'react';

import {
  MetalGrid,
  MetalInput,
  MetalTile,
  MetalValueBox,
} from '@/components/scanner/ReviewCardKit';
import { useStoneRateFetch } from '@/hooks/useStoneRateFetch';
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
  /**
   * Marks the values this stone needs and does not have, once the shop has
   * tried to move on. A stone the tag printed but did not spell out has to be
   * filled in before it can be priced, and a blank box gives no sign of that
   * on its own.
   */
  missing?: boolean;
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
  missing = false,
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
  // Diamond Rate setup permits any one of packet code, shape, color or clarity.
  const hasLookupCriteria =
    stoneType === 'diamond'
      ? Boolean(
          values.packetCode?.trim() ||
            resolvedShape ||
            values.color.trim() ||
            values.clarity.trim(),
        )
      : Boolean(values.color.trim() && values.clarity.trim());

  // A rate the user typed or the scanner read is theirs. Only a rate supplied
  // by the table may be cleared by a later table miss.
  const userTypedRateRef = useRef(false);
  const tableRateRef = useRef<string | null>(null);

  const handleRateFetched = useCallback(
    (fetchedRate: string) => {
      // Not a user edit: the row asked the rate table and is writing down the
      // answer without changing the reader-confidence metadata.
      if (fetchedRate) {
        tableRateRef.current = fetchedRate;
        emitChange({ rate: fetchedRate }, false);
        return;
      }
      const previousTableRate = tableRateRef.current;
      tableRateRef.current = null;
      if (userTypedRateRef.current || !values.rate) return;
      if (stoneType === 'colorstone' || values.rate === previousTableRate) {
        emitChange({ rate: '' }, false);
      }
    },
    [emitChange, stoneType, values.rate],
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


  return (
    <MetalTile title={title} tone={stoneType === 'diamond' ? 'diamond' : 'plain'}>
      <MetalGrid>
        {/* A diamond shows the four the design gives it — weight, rate, packet
            code, amount — and nothing else. Shape, colour, clarity and the
            discount are still read from the tag and still price the stone;
            they are simply not four more boxes to read past on a counter. A
            colorstone keeps its colour and clarity, which are what identifies
            one. */}
        {stoneType === 'colorstone' ? (
          <>
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
          </>
        ) : null}
        <MetalInput
          label={labels.weight}
          value={values.weight}
          onChangeText={(weight) => emitChange({ weight })}
          editable={editable}
          attention={attention?.weight}
          invalid={missing && !values.weight.trim()}
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
          attention={
            stoneType === 'colorstone' && (attention?.rate || (rateNotFound && !values.rate))
          }
          invalid={missing && !values.rate.trim()}
        />
        {stoneType === 'diamond' ? (
          <MetalInput
            label="Packet Code"
            value={values.packetCode ?? ''}
            onChangeText={(packetCode) => emitChange({ packetCode })}
            editable={editable}
            attention={attention?.packetCode}
            invalid={missing && !values.packetCode?.trim()}
          />
        ) : null}
        <MetalValueBox label={labels.amount} value={formatInr(amount)} amount />
      </MetalGrid>
    </MetalTile>
  );
});
