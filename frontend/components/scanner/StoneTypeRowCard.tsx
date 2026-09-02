import { useCallback, useEffect } from 'react';

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

interface StoneTypeRowCardProps {
  title: string;
  stoneType: StoneKind;
  values: StoneTypeRowValues;
  editable?: boolean;
  onChange?: (values: Partial<StoneTypeRowValues>) => void;
  onRateErrorChange?: (hasError: boolean) => void;
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

export function StoneTypeRowCard({
  title,
  stoneType,
  values,
  editable = false,
  onChange,
  onRateErrorChange,
  shapeOptions,
}: StoneTypeRowCardProps) {
  const labels = STONE_LABELS[stoneType];
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
  const hasLookupCriteria =
    stoneType === 'diamond'
      ? Boolean(
          values.packetCode?.trim() ||
            resolvedShape.trim() ||
            values.color.trim() ||
            values.clarity.trim(),
        )
      : Boolean(values.color.trim() && values.clarity.trim());

  const handleRateFetched = useCallback(
    (fetchedRate: string) => {
      if (!fetchedRate) return;
      onChange?.({ rate: fetchedRate });
    },
    [onChange],
  );

  const { isFetching, rateNotFound } = useStoneRateFetch({
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
    onRateErrorChange?.(isError);
  }, [rateNotFound, values.rate, onRateErrorChange]);

  const handleColorChange = (color: string) => {
    onChange?.({ color, quality: buildQuality(color, values.clarity) });
  };

  const handleClarityChange = (clarity: string) => {
    onChange?.({ clarity, quality: buildQuality(values.color, clarity) });
  };

  const handleDiscountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    if (!cleaned) {
      onChange?.({ discountPercent: '' });
      return;
    }
    const parsed = Number.parseFloat(cleaned);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(100, Math.max(0, parsed));
    onChange?.({ discountPercent: String(clamped) });
  };

  return (
    <MetalTile title={title} tone={stoneType === 'diamond' ? 'diamond' : 'plain'}>
      <MetalGrid>
        {stoneType === 'diamond' ? (
          <MetalFieldSlot label="Shape">
            <SearchableSelectDropdown compact
              value={resolvedShape}
              options={dropdownOptions}
              onChange={(shape) => onChange?.({ shape })}
              placeholder="None"
              containerClassName="w-full"
            />
          </MetalFieldSlot>
        ) : null}
        {stoneType === 'diamond' ? (
          <MetalInput
            label="Packet Code"
            value={values.packetCode ?? ''}
            onChangeText={(packetCode) => onChange?.({ packetCode })}
            editable={editable && !isFetching}
            placeholder="e.g. PKT-123"
          />
        ) : null}
        <MetalInput
          label="Color"
          value={values.color}
          onChangeText={handleColorChange}
          editable={editable && !isFetching}
          placeholder="e.g. GH"
        />
        <MetalInput
          label="Clarity"
          value={values.clarity}
          onChangeText={handleClarityChange}
          editable={editable && !isFetching}
          placeholder="e.g. VVS"
        />
        <MetalInput
          label={labels.weight}
          value={values.weight}
          onChangeText={(weight) => onChange?.({ weight })}
          editable={editable && !isFetching}
          placeholder="from scan result"
        />
        <MetalInput
          label={labels.rate}
          value={values.rate}
          onChangeText={(text) => onChange?.({ rate: text.replace(/[^0-9.]/g, '') })}
          editable={editable && !isFetching}
          placeholder="Enter rate"
          keyboardType="decimal-pad"
        />
        {stoneType === 'diamond' ? (
          <MetalInput
            label={labels.discount ?? 'Discount'}
            value={values.discountPercent ?? ''}
            onChangeText={handleDiscountChange}
            editable={editable && !isFetching}
            placeholder="0"
            keyboardType="decimal-pad"
          />
        ) : null}
        <MetalValueBox label={labels.amount} value={formatInr(amount)} amount />
      </MetalGrid>
    </MetalTile>
  );
}
