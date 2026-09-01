import { DEFAULT_LABOUR_WEIGHT_BASIS, type LabourWeightBasis } from '@/constants/labour';
import type { LabourChargeType, LabourRate, UpsertLabourRatePayload } from '@/types/rates';

export interface LabourRateFormErrors {
  amount?: string;
}

export function labourWeightBasisLabel(basis: LabourWeightBasis): string {
  return basis === 'net' ? 'Net wt' : 'Gross wt';
}

export function formatLabourRateDisplay(rate: LabourRate | null): string {
  if (!rate) return 'Empty';
  if (rate.chargeType === 'PERCENTAGE') {
    return `${rate.value}% purity of gold`;
  }
  const basis = rate.weightBasis ?? DEFAULT_LABOUR_WEIGHT_BASIS;
  return `₹ ${rate.value.toLocaleString('en-IN')} (${labourWeightBasisLabel(basis)})`;
}

export function validateLabourRateAmount(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const num = Number(trimmed.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) {
    return 'Enter a valid amount greater than 0.';
  }
  return null;
}

export function validateLabourRateForm(amount: string): LabourRateFormErrors | null {
  const amountError = validateLabourRateAmount(amount);
  if (amountError) return { amount: amountError };
  return null;
}

export function labourRateFormToPayload(
  amount: string,
  weightBasis: LabourWeightBasis,
): UpsertLabourRatePayload | null {
  if (validateLabourRateForm(amount)) return null;

  // An empty box clears the default rate rather than saving a zero.
  if (!amount.trim()) {
    return {
      chargeType: 'NONE' as LabourChargeType,
      value: 0,
    };
  }

  return {
    chargeType: 'AMOUNT',
    value: Number(amount.replace(/[^\d.]/g, '')),
    // The screen no longer offers a per-10-gram rate, but the unit is still a
    // required field on the server — omitting it is rejected outright. Sent
    // explicitly so saving works against a server of either vintage.
    rupeesUnit: 'Per Gram',
    weightBasis,
  };
}

export function labourRateToFormValues(rate: LabourRate | null): {
  amount: string;
  weightBasis: LabourWeightBasis;
} {
  if (!rate || rate.chargeType !== 'AMOUNT') {
    return { amount: '', weightBasis: DEFAULT_LABOUR_WEIGHT_BASIS };
  }
  return {
    amount: String(rate.value),
    weightBasis: rate.weightBasis ?? DEFAULT_LABOUR_WEIGHT_BASIS,
  };
}
