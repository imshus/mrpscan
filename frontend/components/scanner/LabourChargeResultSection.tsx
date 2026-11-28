import { FinRow, MetalTile } from '@/components/scanner/ReviewCardKit';
import {
  DEFAULT_LABOUR_WEIGHT_BASIS,
  LABOUR_WEIGHT_OPTIONS,
  type LabourChargeUnit,
  type LabourWeightBasis,
} from '@/constants/labour';
import type { FinalTabPricingResult } from '@/utils/scanPriceCalculation';

interface LabourChargeResultSectionProps {
  pricing: FinalTabPricingResult;
  /** The scan's labour as the review card held it when it was priced. */
  labourCode?: string;
  labourChargeAmount?: string;
  labourChargeUnit?: LabourChargeUnit;
  labourWeightBasis?: LabourWeightBasis;
}

/** "₹600 /g", "₹6,000 /10g" or "12%"; a dash when no rate was given. */
function labourRateText(amount: string | undefined, unit: LabourChargeUnit | undefined): string {
  const n = Number(String(amount ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (unit === 'Percent' || String(amount).includes('%')) return `${n}%`;
  const rupees = `₹${n.toLocaleString('en-IN')}`;
  return unit === 'Per 10 Gram' ? `${rupees} /10g` : `${rupees} /g`;
}

/**
 * The results view's Labour Charge card, as the design's result view has it:
 * Labour Code, Labour Rate, Weight Used and Final Labour Amount.
 */
export function LabourChargeResultSection({
  pricing,
  labourCode,
  labourChargeAmount,
  labourChargeUnit,
  labourWeightBasis,
}: LabourChargeResultSectionProps) {
  const basis = labourWeightBasis || DEFAULT_LABOUR_WEIGHT_BASIS;
  const weightUsed = LABOUR_WEIGHT_OPTIONS.find((option) => option.value === basis)?.label ?? '—';
  return (
    <MetalTile title="Labour Charge" tone="labour">
      {/* The Masters → Labour Code the price was made with, else the scan's. */}
      <FinRow label="Labour Code" value={pricing.labourCode || labourCode?.trim() || '—'} />
      <FinRow label="Labour Rate" value={labourRateText(labourChargeAmount, labourChargeUnit)} />
      <FinRow label="Weight Used" value={weightUsed} />
      <FinRow label="Final Labour Amount" value={pricing.labourDisplay} amount />
    </MetalTile>
  );
}
