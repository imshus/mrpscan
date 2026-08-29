import type { StoneRate } from '@/types/rates';

export function formatStoneRatePerCt(rate: number): string {
  return `₹${rate.toLocaleString('en-IN')}`;
}

export function displayStoneField(value: string): string {
  return value.trim() ? value.trim() : '—';
}

export function stoneRateKey(
  color: string,
  clarity: string,
  shape?: string,
  packetCode?: string,
): string {
  const packetKey = packetCode?.trim().toLowerCase() ?? '';
  if (packetKey) return `packet:${packetKey}`;
  const shapeKey = shape?.trim().toLowerCase() ?? '';
  return `${color.trim().toLowerCase()}|${clarity.trim().toLowerCase()}|${shapeKey}`;
}

export function createLocalStoneRateId(): string {
  return `stone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function validateStoneRateForm(
  color: string,
  clarity: string,
  rateValue: string,
  shape?: string,
  requireShape = false,
): { color?: string; clarity?: string; rate?: string; shape?: string } | null {
  const errors: { color?: string; clarity?: string; rate?: string; shape?: string } = {};
  const hasColor = Boolean(color.trim());
  const hasClarity = Boolean(clarity.trim());
  const hasShape = Boolean(shape?.trim());

  if (!hasColor && !hasClarity) {
    errors.color = 'Select at least Color or Clarity.';
    errors.clarity = 'Select at least Color or Clarity.';
  }

  if (requireShape && !hasShape) {
    errors.shape = 'Select a shape.';
  }

  const rate = Number(rateValue);
  if (!rateValue.trim() || !Number.isFinite(rate) || rate <= 0) {
    errors.rate = 'Enter a valid rate.';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

export function findDuplicateStoneRate(
  rates: StoneRate[],
  color: string,
  clarity: string,
  shape?: string,
  packetCode?: string,
  excludeId?: string,
): boolean {
  const key = stoneRateKey(color, clarity, shape, packetCode);
  return rates.some(
    (item) =>
      item.id !== excludeId &&
      stoneRateKey(item.color, item.clarity, item.shape, item.packetCode) === key,
  );
}

export function stoneRateSummary(rate: StoneRate): string {
  const parts = [
    displayStoneField(rate.packetCode ?? ''),
    displayStoneField(rate.color),
    displayStoneField(rate.clarity),
    displayStoneField(rate.shape ?? ''),
  ].filter((part) => part !== '—');
  const label = parts.length > 0 ? parts.join(' · ') : 'this rate';
  return `${label} (${formatStoneRatePerCt(rate.rate)})`;
}
