import type { GoldIncreaseByType, GoldRate, McxChange } from '@/types/rates';

export type ScannerCalculationUse = 'rtgs' | 'cash';

export function formatKaratLabel(carat: string): string {
  return carat.replace(/Kt/gi, ' KT').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function formatMcxLiveRate(mcxLiveRate: number): string {
  return `₹${mcxLiveRate.toLocaleString('en-IN')} per 10gm`;
}

export function resolveMcxChangeValue(mcxChange?: McxChange, fallback = 0): number {
  if (!mcxChange) return fallback;
  const amount = Number.isFinite(mcxChange.amount) ? mcxChange.amount : 0;
  return mcxChange.operation === '-' ? -amount : amount;
}

export function calculateBaseGoldRate(mcxLiveRate: number, purity: number): number {
  return Math.round(mcxLiveRate * (purity / 99.9));
}

export function applyGoldIncrease(
  baseRate: number,
  increaseByAmount: number,
  increaseByType: GoldIncreaseByType,
): number {
  if (!increaseByAmount || !Number.isFinite(increaseByAmount)) {
    return baseRate;
  }
  if (increaseByType === 'PERCENTAGE') {
    return Math.round(baseRate + baseRate * (increaseByAmount / 100));
  }
  return Math.round(baseRate + increaseByAmount);
}

export function computeFinalGoldRate(
  mcxLiveRate: number,
  purity: number,
  increaseByAmount = 0,
  increaseByType: GoldIncreaseByType = 'FLAT',
): number {
  const baseRate = calculateBaseGoldRate(mcxLiveRate, purity);
  return applyGoldIncrease(baseRate, increaseByAmount, increaseByType);
}

export function flatIncreaseForFinalRate(baseRate: number, finalRate: number): number {
  return Math.round(finalRate - baseRate);
}

export function validatePurityValue(purity: number): string | null {
  if (!Number.isFinite(purity) || purity <= 0 || purity > 100) {
    return 'Purity must be between 0 and 100.';
  }
  return null;
}

export function validateFinalRateValue(finalRate: number): string | null {
  if (!Number.isFinite(finalRate) || finalRate <= 0) {
    return 'Final rate must be greater than 0.';
  }
  return null;
}

export function validateIncreaseAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount < 0) {
    return 'Increase amount must be 0 or greater.';
  }
  return null;
}

export function formatTaxChange(change: number): string {
  if (!change) return '+ 0';
  const sign = change > 0 ? '+' : '-';
  return `${sign} ${Math.abs(change).toLocaleString('en-IN')}`;
}

export function deriveActiveBaseRate(
  scannerCalculationUse: ScannerCalculationUse,
  mcxLiveRate: number,
  rtgsFinalRate: number,
  cashFinalRate: number,
): number {
  switch (scannerCalculationUse) {
    case 'rtgs':
      return rtgsFinalRate;
    case 'cash':
      return cashFinalRate;
    default:
      // Fallback to RTGS final rate for safety
      return rtgsFinalRate;
  }
}

export function computeDisplayGoldRates(
  rates: GoldRate[],
  activeBaseRate: number,
): GoldRate[] {
  return rates.map((rate) => ({
    ...rate,
    finalRate: computeFinalGoldRate(
      activeBaseRate,
      rate.purity,
      rate.increaseByAmount ?? 0,
      rate.increaseByType ?? 'FLAT',
    ),
  }));
}
