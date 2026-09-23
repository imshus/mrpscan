import { memo, useState } from 'react';

import {
  AmountTile,
  InlineOptionList,
  MetalFieldSlot,
  MetalGrid,
  MetalInput,
  MetalSelectTrigger,
  MetalTile,
  MetalValueBox,
} from '@/components/scanner/ReviewCardKit';
import {
  DEFAULT_LABOUR_CHARGE_UNIT,
  DEFAULT_LABOUR_WEIGHT_BASIS,
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
): number {
  const grossWt = parseWeightValue(grossWeightGrams);
  const netWt = parseWeightValue(netWeightGrams);
  const selectedWeight = values.labourWeightBasis === 'gross' ? grossWt : netWt;
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

export const LaborSection = memo(function LaborSection({
  values,
  onChange,
  grossWeightGrams = '',
  netWeightGrams = '',
  pureWeightDisplay = '—',
  goldAmountDisplay = '—',
  missing = false,
}: LaborSectionProps) {

  const handleChargeChange = (text: string) => {
    const next = sanitizeChargeAmount(text);
    onChange({
      labourChargeAmount: next,
    });
  };

  return (
    <>
      <MetalTile title="Labour Charge" tone="labour">
        <MetalGrid>
          <MetalInput
            label="Labour Rate"
            value={values.labourChargeAmount}
            onChangeText={handleChargeChange}
            keyboardType="number-pad"
            prefix="₹"
            invalid={missing && !values.labourChargeAmount.trim()}
          />
          <MetalFieldSlot label="Weight Used">
            <WeightDropdown
              value={values.labourWeightBasis}
              onChange={(labourWeightBasis) => onChange({ labourWeightBasis })}
              disabled={false}
            />
          </MetalFieldSlot>
          {/* The labour amount inside its own card, as the design has it —
              it used to sit under Wastage and read as one card with it. */}
          <MetalValueBox
            label="Labour Amount"
            value={formatInr(computeFinalLabourAmount(values, grossWeightGrams, netWeightGrams))}
            amount
            fullWidth
          />
        </MetalGrid>
      </MetalTile>
    </>
  );
});

export function getLaborValuesFromScanData(
  scanData: Pick<
    ScanItemData,
    'labourPurityPercent' | 'labourChargeAmount' | 'labourChargeUnit' | 'labourWeightBasis'
  >,
): LaborSectionValues {
  return {
    labourPurityPercent: scanData.labourPurityPercent || '',
    labourChargeAmount: scanData.labourChargeAmount || '',
    labourChargeUnit: scanData.labourChargeUnit || DEFAULT_LABOUR_CHARGE_UNIT,
    labourWeightBasis: scanData.labourWeightBasis || DEFAULT_LABOUR_WEIGHT_BASIS,
  };
}
