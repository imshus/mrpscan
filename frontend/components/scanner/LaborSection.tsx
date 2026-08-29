import { useMemo, useState } from 'react';

import {
  AmountTile,
  InlineOptionList,
  MetalFieldSlot,
  MetalGrid,
  MetalInput,
  MetalSelectTrigger,
  MetalTile,
} from '@/components/scanner/ReviewCardKit';
import {
  LABOUR_WEIGHT_OPTIONS,
  type LabourChargeUnit,
  type LabourWeightBasis,
} from '@/constants/labour';
import type { ScanItemData } from '@/types/scanner';
import { parseWeightValue } from '@/utils/formulaUtils';

export interface LaborSectionValues {
  labourPurityPercent: string;
  labourChargeAmount: string;
  labourChargeUnit: LabourChargeUnit;
  labourWeightBasis: LabourWeightBasis;
}

interface LaborSectionProps {
  values: LaborSectionValues;
  onChange: (values: Partial<LaborSectionValues>) => void;
  grossWeightGrams?: string;
  netWeightGrams?: string;
  pureWeightDisplay?: string;
  goldAmountDisplay?: string;
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
  return text.replace(/[₹,\s]/g, '');
}

function WeightDropdown({
  value,
  onChange,
  disabled,
}: {
  value: LabourWeightBasis;
  onChange: (unit: LabourWeightBasis) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = LABOUR_WEIGHT_OPTIONS.find((opt) => opt.value === value)?.label ??
    LABOUR_WEIGHT_OPTIONS[0].label;

  return (
    <>
      <MetalSelectTrigger
        value={selectedLabel}
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
      />
      {open && !disabled ? (
        <InlineOptionList
          options={LABOUR_WEIGHT_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          selected={value}
          onSelect={(unit) => {
            onChange(unit);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function LaborSection({
  values,
  onChange,
  grossWeightGrams = '',
  netWeightGrams = '',
  pureWeightDisplay = '—',
  goldAmountDisplay = '—',
}: LaborSectionProps) {
  const grossWt = parseWeightValue(grossWeightGrams);
  const netWt = parseWeightValue(netWeightGrams);
  const selectedWeight = values.labourWeightBasis === 'gross' ? grossWt : netWt;

  const computedLaborAmount = useMemo(() => {
    const rate = Number(values.labourChargeAmount) || 0;
    if (rate <= 0 || selectedWeight <= 0) return 0;
    if (values.labourChargeUnit === 'Per 10 Gram') {
      return selectedWeight * (rate / 10);
    }
    return selectedWeight * rate;
  }, [selectedWeight, values.labourChargeAmount, values.labourChargeUnit]);

  const handleChargeChange = (text: string) => {
    const next = sanitizeChargeAmount(text);
    onChange({
      labourChargeAmount: next,
    });
  };

  return (
    <>
      <MetalTile title="Labour Charge" tone="plain">
        <MetalGrid>
          <MetalInput
            label="Labour Rate"
            value={values.labourChargeAmount}
            onChangeText={handleChargeChange}
            placeholder="Enter rate"
            keyboardType="number-pad"
            prefix="₹"
          />
          <MetalFieldSlot label="Weight Used">
            <WeightDropdown
              value={values.labourWeightBasis}
              onChange={(labourWeightBasis) => onChange({ labourWeightBasis })}
              disabled={false}
            />
          </MetalFieldSlot>
        </MetalGrid>
      </MetalTile>

      <AmountTile label="Final Labour Amount" value={formatInr(computedLaborAmount)} />
    </>
  );
}

export function getLaborValuesFromScanData(
  scanData: Pick<
    ScanItemData,
    'labourPurityPercent' | 'labourChargeAmount' | 'labourChargeUnit' | 'labourWeightBasis'
  >,
): LaborSectionValues {
  return {
    labourPurityPercent: scanData.labourPurityPercent || '',
    labourChargeAmount: scanData.labourChargeAmount || '',
    labourChargeUnit: scanData.labourChargeUnit || 'Per Gram',
    labourWeightBasis: scanData.labourWeightBasis || 'gross',
  };
}
