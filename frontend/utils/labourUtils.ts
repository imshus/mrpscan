import {
  DEFAULT_LABOUR_CHARGE_UNIT,
  DEFAULT_LABOUR_CHARGE_UNITS,
  LABOUR_VALIDATION_MESSAGE,
  type LabourChargeUnit,
} from '@/constants/labour';
import type { ScanItemData } from '@/types/scanner';

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

function parseChargeUnitFromText(raw: string): LabourChargeUnit {
  if (/per\s*10\s*gram/i.test(raw)) return 'Per 10 Gram';
  if (/per\s*1\s*gram/i.test(raw)) return 'Per Gram';
  if (/per\s*gram/i.test(raw)) return 'Per Gram';
  return DEFAULT_LABOUR_CHARGE_UNIT;
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

  const pipeParts = labourRaw.split('|');
  if (pipeParts.length === 2 && parseNumericLabourValue(pipeParts[0]) !== null) {
    const unit = DEFAULT_LABOUR_CHARGE_UNITS.includes(pipeParts[1].trim() as LabourChargeUnit)
      ? (pipeParts[1].trim() as LabourChargeUnit)
      : DEFAULT_LABOUR_CHARGE_UNIT;
    return {
      labourPurityPercent: '',
      labourChargeAmount: String(parseNumericLabourValue(pipeParts[0])),
      labourChargeUnit: unit,
    };
  }

  const kind = classifyOcrLabourValue(labourRaw);
  if (kind === 'purity') {
    return {
      ...empty,
      labourPurityPercent: formatPurityPercent(labourRaw),
    };
  }

  if (kind === 'charge') {
    return {
      ...empty,
      labourChargeAmount: String(parseNumericLabourValue(labourRaw) ?? ''),
      labourChargeUnit: parseChargeUnitFromText(labourRaw),
    };
  }

  return {
    ...empty,
    labourChargeAmount: labourRaw.trim(),
  };
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
