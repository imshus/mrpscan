import { memo, useCallback, useEffect, useRef } from 'react';

import {
  MetalGrid,
  MetalInput,
  MetalTile,
  MetalValueBox,
} from '@/components/scanner/ReviewCardKit';
import { useStoneRateFetch } from '@/hooks/useStoneRateFetch';
import type { StoneKind } from '@/types/scanner';
import {
  computeStoneAmountWithDiscount,
  computeStoneAmount,
  stoneCaratsText,
} from '@/utils/scanPriceCalculation';
import { parseNumericLabourValue } from '@/utils/labourUtils';
import { roundHalfUp } from '@/utils/moneyMath';

export interface StoneTypeRowValues {
  weight: string;
  color: string;
  clarity: string;
  quality: string;
  rate: string;
  discountPercent?: string;
  shape?: string;
  packetCode?: string;
  /** The weight's unit as printed: 'g' is priced as 5 ct a gram. */
  unit?: 'g' | 'ct';
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
  return `₹${roundHalfUp(amount).toLocaleString('en-IN')}`;
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
  // In carats, as the server prices it: a weight printed in grams is 5 ct a gram.
  const carats = stoneCaratsText(values);
  const amount =
    stoneType === 'diamond'
      ? computeStoneAmountWithDiscount(carats, values.rate, values.discountPercent)
      : computeStoneAmount(carats, values.rate);
  const resolvedShape = (() => {
    const raw = values.shape?.trim() ?? '';
    if (!raw) return '';
    if (raw.toLowerCase() === 'none') return '';
    const match = shapeOptions?.find((opt) => opt.value.toLowerCase() === raw.toLowerCase());
    return match?.value ?? raw;
  })();
  // Diamond Rate setup permits any one of packet code, shape, color or
  // clarity; a colour stone is found by its packet code, or a colour or a
  // clarity, as the server finds it.
  const hasLookupCriteria =
    stoneType === 'diamond'
      ? Boolean(
          values.packetCode?.trim() ||
            resolvedShape ||
            values.color.trim() ||
            values.clarity.trim(),
        )
      : Boolean(values.packetCode?.trim() || values.color.trim() || values.clarity.trim());

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
      // Only a rate the table supplied goes with a miss: a printed rate is
      // the tag's and stays, as the server prices a stone no row matches.
      // A colour stone's printed rate used to be cleared here.
      if (values.rate === previousTableRate) {
        emitChange({ rate: '' }, false);
      }
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
    packetCode: values.packetCode,
    enabled: editable && hasLookupCriteria,
    onRateFetched: handleRateFetched,
  });

  useEffect(() => {
    const rateValue = parseNumericLabourValue(values.rate) ?? 0;
    const isError = rateNotFound && rateValue <= 0;
    onRateErrorChange?.(sequenceIndex, isError);
  }, [rateNotFound, values.rate, onRateErrorChange, sequenceIndex]);


  return (
    <MetalTile title={title} tone={stoneType === 'diamond' ? 'diamond' : 'plain'}>
      <MetalGrid>
        {/* A diamond shows the four the design gives it — weight, rate, packet
            code, amount — and a colorstone three — weight, rate, amount — and
            nothing else, at the shop's asking. Shape, colour, clarity and the
            discount are still read from the tag and still price the stone;
            they are simply not more boxes to read past on a counter. */}
        <MetalInput
          label={values.unit === 'g' ? `${labels.weight} (g)` : labels.weight}
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
          />
        ) : null}
        {/* A colorstone's third box takes the full row, under weight and rate. */}
        <MetalValueBox
          label={labels.amount}
          value={formatInr(amount)}
          amount
          fullWidth={stoneType === 'colorstone'}
        />
      </MetalGrid>
    </MetalTile>
  );
});
