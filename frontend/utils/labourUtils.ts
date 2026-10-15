import {
  DEFAULT_LABOUR_CHARGE_UNIT,
  LABOUR_CHARGE_UNITS,
  LABOUR_VALIDATION_MESSAGE,
  type LabourChargeUnit,
} from '@/constants/labour';
import type { ScanItemData } from '@/types/scanner';
import { labourUnitOf, parseTagLabour } from '@/utils/pricingRules';

export function parseNumericLabourValue(raw: string): number | null {
  const cleaned = raw.replace(/[₹,%\s]/g, '').replace(/,/g, '');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

/** OCR rule: 0 < value ≤ 100 → purity; value > 100 → labor charge amount. */
export function classifyOcrLabourValue(raw: string): 'purity' | 'charge' | null {
  const num = parseNumericLabourValue(raw);
  if (num === null || num <= 0) return null;
  if (num <= 100) return 'purity';
  return 'charge';
}

export function formatPurityPercent(value: string): string {
  const num = parseNumericLabourValue(value);
  if (num === null) return '';
  return `${num}%`;
}

export function parseLabourFromApi(labourRaw: string): Pick<
  ScanItemData,
  'labourPurityPercent' | 'labourChargeAmount' | 'labourChargeUnit'
> {
  const empty = {
    labourPurityPercent: '',
    labourChargeAmount: '',
    labourChargeUnit: DEFAULT_LABOUR_CHARGE_UNIT,
  };

  if (!labourRaw?.trim()) return empty;

  // The tag's labour, read exactly as the server reads it for the price it
  // makes inside the analysis (utils/pricingRules parseTagLabour): "12%" is
  // 12 percent of the gold value, "MC 850" is Rs 850 a gram, "850|Per 10
  // Gram" as it says. A "12%" used to be filed as a labour purity nothing
  // priced, and text it could not read was sent as it stood ("MC 850",
  // "NIL"), which the server then refused.
  const fromTag = parseTagLabour(labourRaw);
  if (fromTag) {
    return {
      ...empty,
      labourChargeAmount: String(fromTag.amount),
      labourChargeUnit: fromTag.unit,
    };
  }

  // Nothing priceable: a plain figure up to 100 (a rate or a percent?) or
  // text with no number. The item's or the shop's charge fills the box, as
  // the server prices the same tag.
  return empty;
}

/** A labour unit the card can hold: the rupee units or a percent. */
export function toLabourChargeUnit(raw: unknown): LabourChargeUnit {
  const unit = labourUnitOf(raw);
  return unit && LABOUR_CHARGE_UNITS.includes(unit) ? unit : DEFAULT_LABOUR_CHARGE_UNIT;
}

export function serializeLabourForApi(
  data: Pick<ScanItemData, 'labourPurityPercent' | 'labourChargeAmount' | 'labourChargeUnit'>,
): string {
  if (data.labourPurityPercent.trim()) {
    return formatPurityPercent(data.labourPurityPercent);
  }
  if (data.labourChargeAmount.trim()) {
    const amount = parseNumericLabourValue(data.labourChargeAmount);
    const amountStr = amount !== null ? String(amount) : data.labourChargeAmount.trim();
    return `${amountStr}|${data.labourChargeUnit}`;
  }
  return '';
}

export function formatLabourDisplay(
  data: Pick<ScanItemData, 'labourPurityPercent' | 'labourChargeAmount' | 'labourChargeUnit'>,
): string {
  if (data.labourPurityPercent.trim()) {
    return formatPurityPercent(data.labourPurityPercent);
  }
  if (data.labourChargeAmount.trim()) {
    const amount = parseNumericLabourValue(data.labourChargeAmount) ?? data.labourChargeAmount;
    if (data.labourChargeUnit === 'Percent') return `${amount}% of gold`;
    return `₹${amount} ${data.labourChargeUnit}`;
  }
  return '';
}

export function hasActiveLabourPurity(
  data: Pick<ScanItemData, 'labourPurityPercent'>,
): boolean {
  return Boolean(data.labourPurityPercent.trim());
}

export function hasActiveLabourCharge(
  data: Pick<ScanItemData, 'labourChargeAmount'>,
): boolean {
  return Boolean(data.labourChargeAmount.trim());
}

export function validateLabour(
  data: Pick<ScanItemData, 'labourPurityPercent' | 'labourChargeAmount'>,
): string | null {
  const hasPurity = hasActiveLabourPurity(data);
  const hasCharge = hasActiveLabourCharge(data);

  if (!hasPurity && !hasCharge) return LABOUR_VALIDATION_MESSAGE;
  if (hasPurity && hasCharge) return LABOUR_VALIDATION_MESSAGE;
  return null;
}
