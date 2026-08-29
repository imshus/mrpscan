import type { GoldRate } from '@/types/rates';
import type { OtherChargeItem, ScanItemData, StoneEntry } from '@/types/scanner';
import { normalizeKarat, parseWeightValue } from '@/utils/formulaUtils';
import {
  deriveActiveBaseRate,
  type ScannerCalculationUse,
} from '@/utils/goldRateUtils';
import { hasActiveLabourPurity, parseNumericLabourValue } from '@/utils/labourUtils';
import { buildQuality } from '@/utils/qualityUtils';
import { computeStoneAmountWithDiscount, parseNumericValue } from '@/utils/scanPriceCalculation';

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

export interface InvoiceGoldPriceInput {
  scanData: ScanItemData;
  goldRates: GoldRate[];
  activeBaseRate: number;
  selectedKarat: string;
}

export function computeGoldPerGramPrice(input: InvoiceGoldPriceInput): number {
  // Labour purity override removed - no longer supported
  
  const normalizedKarat = normalizeKarat(input.selectedKarat);
  const tableMatch = input.goldRates.find(
    (rate) => normalizeKarat(rate.carat) === normalizedKarat,
  );
  if (tableMatch?.purity && input.activeBaseRate > 0) {
    return (input.activeBaseRate * (tableMatch.purity / 100)) / 10;
  }

  const fromScan = parseNumericValue(input.scanData.goldRate);
  if (fromScan > 0) return fromScan;

  return 0;
}

export function buildGoldLineItemRow(input: InvoiceGoldPriceInput): InvoiceLineItemRow {
  const netWtGrams = parseWeightValue(input.scanData.netWt);
  const pricePerGram = computeGoldPerGramPrice(input);
  const amount = netWtGrams * pricePerGram;

  return {
    key: 'gold-base-metal',
    description: 'Gold (in grams)',
    note: input.selectedKarat || '—',
    qty: netWtGrams,
    qtyUnit: 'g',
    price: pricePerGram,
    amount,
  };
}

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
