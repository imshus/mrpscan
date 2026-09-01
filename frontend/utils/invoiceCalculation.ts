import type { GoldRate } from '@/types/rates';
import type { OtherChargeItem, StoneEntry } from '@/types/scanner';
import { parseWeightValue } from '@/utils/formulaUtils';
import {
  deriveActiveBaseRate,
  type ScannerCalculationUse,
} from '@/utils/goldRateUtils';
import { buildQuality } from '@/utils/qualityUtils';
import {
  computeStoneAmountWithDiscount,
  parseNumericValue,
} from '@/utils/scanPriceCalculation';

export const GST_RATE_OPTIONS = [0, 3, 5, 9, 18, 28] as const;
export type GstRateOption = (typeof GST_RATE_OPTIONS)[number];

export interface InvoiceLineItemRow {
  key: string;
  description: string;
  note: string;
  qty: number;
  qtyUnit: string;
  price: number;
  amount: number;
}

/*
 * Gold and labour are no longer priced here.
 *
 * They come from the backend MRP breakdown via useInvoiceComputation, which
 * is the same breakdown the scanner preview screen displays. Recomputing
 * either one on the device is what made the invoice disagree with the price
 * the customer had already been quoted.
 */

const STONE_TYPE_LABELS: Record<StoneEntry['stoneType'], string> = {
  diamond: 'Diamond',
  colorstone: 'Colorstone',
};

export function buildStoneLineItemRows(stones: StoneEntry[]): InvoiceLineItemRow[] {
  return stones.map((entry, index) => {
    const qty = parseWeightValue(entry.weight);
    const price = parseNumericValue(entry.rate);
    const amount =
      entry.stoneType === 'diamond'
        ? computeStoneAmountWithDiscount(entry.weight, entry.rate, entry.discountPercent)
        : qty * price;
    const note =
      [entry.color, entry.clarity].filter(Boolean).join(' / ') ||
      entry.quality ||
      buildQuality(entry.color, entry.clarity) ||
      '—';

    return {
      key: `stone-${entry.stoneType}-${index}`,
      description: `${STONE_TYPE_LABELS[entry.stoneType]} (in carats)`,
      note,
      qty,
      qtyUnit: 'Ct',
      price,
      amount,
    };
  });
}

export function buildOtherChargeLineItemRows(
  items: OtherChargeItem[],
  remarks?: string,
): InvoiceLineItemRow[] {
  const note = remarks?.trim() ? `Other Charges — ${remarks.trim()}` : 'Other Charges';
  return items.map((item) => ({
    key: `other-charge-${item.id}`,
    description: item.name,
    note,
    qty: 1,
    qtyUnit: '',
    price: item.amount,
    amount: item.amount,
  }));
}

export function computeInvoiceSubtotal(rows: InvoiceLineItemRow[]): number {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

export function computeGstAmount(subtotal: number, gstRate: GstRateOption): number {
  return (subtotal * gstRate) / 100;
}

export function computeGrandTotal(subtotal: number, gstAmount: number): number {
  return subtotal + gstAmount;
}

export function formatInvoiceDateTime(date: Date = new Date()): string {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Generates a client-side PREVIEW of the invoice number in the correct
 * server format: INV-YYYY-MMDD-?????
 * The real sequential number (00001, 00002…) is assigned by the server on submit.
 */
export function resolveInvoiceNumber(_scanId: string | null, _sku: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `INV-${year}-${mm}${dd}-?????`;
}

export function prepareDisplayGoldRates(
  rates: GoldRate[],
  mcxLiveRate: number,
  rtgsChange = 0,
  cashChange = 0,
  scannerCalculationUse: ScannerCalculationUse = 'rtgs',
  mcxFinalRate?: number,
): { displayRates: GoldRate[]; activeBaseRate: number } {
  const baseMcx = mcxFinalRate ?? mcxLiveRate;
  const rtgsFinalRate = baseMcx + rtgsChange;
  const cashFinalRate = baseMcx + cashChange;
  const activeBaseRate = deriveActiveBaseRate(
    scannerCalculationUse,
    baseMcx,
    rtgsFinalRate,
    cashFinalRate,
  );
  return { displayRates: rates, activeBaseRate };
}
