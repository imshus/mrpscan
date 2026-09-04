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

function normalizedLookupKey(value: unknown): string {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizedShapeKey(value: unknown): string {
  const key = normalizedLookupKey(value);
  return key === '0' || key === 'NONE' ? '' : key;
}

/**
 * Finds the most specific configured diamond rate that the scanned fields can
 * identify. Empty fields in a configured row act as wildcards, which mirrors
 * the Diamond Rate form where packet code, shape, color and clarity are all
 * individually optional.
 */
export function findMatchingDiamondRate(
  rates: StoneRate[],
  color: string,
  clarity: string,
  shape?: string,
  packetCode?: string,
): StoneRate | undefined {
  const packetKey = normalizedLookupKey(packetCode);
  if (packetKey) {
    const packetMatch = rates.find(
      (rate) => normalizedLookupKey(rate.packetCode) === packetKey,
    );
    if (packetMatch) return packetMatch;
  }

  const requested = {
    color: normalizedLookupKey(color),
    clarity: normalizedLookupKey(clarity),
    shape: normalizedShapeKey(shape),
  };
  if (!requested.color && !requested.clarity && !requested.shape) return undefined;

  return rates
    .map((rate, index) => {
      // Packet-specific rows must only be selected by their packet code.
      if (normalizedLookupKey(rate.packetCode)) return null;

      const configured = {
        color: normalizedLookupKey(rate.color),
        clarity: normalizedLookupKey(rate.clarity),
        shape: normalizedShapeKey(rate.shape),
      };
      const fields = (['color', 'clarity', 'shape'] as const).filter(
        (field) => configured[field],
      );
      if (
        fields.length === 0 ||
        fields.some((field) => !requested[field] || configured[field] !== requested[field])
      ) {
        return null;
      }

      // Prefer more specific rows. For equally specific rows, the traditional
      // color + clarity grade wins, then a shape-qualified row.
      const score =
        fields.length * 100 +
        (configured.color && configured.clarity ? 20 : 0) +
        (configured.shape ? 10 : 0) +
        (configured.color ? 2 : 0) +
        (configured.clarity ? 1 : 0);
      return { rate, score, index };
    })
    .filter((candidate): candidate is { rate: StoneRate; score: number; index: number } => !!candidate)
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.rate;
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
