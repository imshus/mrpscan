import { useMemo } from 'react';

import { useInvoiceStore } from '@/store/invoiceStore';
import { useScannerStore } from '@/store/scannerStore';
import {
  computeGrandTotal,
  computeGstAmount,
  type InvoiceLineItemRow,
} from '@/utils/invoiceCalculation';
import { buildInvoiceLines, sumLineAmounts } from '@/utils/moneyMath';
import { amountInWords } from '@/utils/numberToWords';
import { parseWeightValue, resolveScannedKarat } from '@/utils/formulaUtils';
import { type FinalTabPricingResult } from '@/utils/scanPriceCalculation';

/** Zero pricing, used only if the invoice is opened without a preview behind it. */
const EMPTY_PRICING: Pick<
  FinalTabPricingResult,
  | 'netWtGrams'
  | 'goldBasePrice'
  | 'goldRatePerGram'
  | 'selectedKarat'
  | 'stoneRows'
  | 'labourAmount'
  | 'otherChargesAmount'
  | 'ultimateMrp'
> & Partial<FinalTabPricingResult> = {
  netWtGrams: 0,
  goldBasePrice: 0,
  goldRatePerGram: 0,
  selectedKarat: '',
  stoneRows: [],
  labourAmount: 0,
  otherChargesAmount: 0,
  ultimateMrp: 0,
};

export interface InvoiceComputation {
  lineItemRows: InvoiceLineItemRow[];
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  grandTotal: number;
  grandTotalWords: string;
  ratesLoaded: boolean;
}

/**
 * The invoice's line items and totals.
 *
 * Every figure is the one the scanner preview screen put on the store as it
 * rendered. The invoice used to re-derive gold, labour and the subtotal on the
 * device with its own formulas, which disagreed with the preview — the server
 * prices gold as pure weight × the 24K RTGS/cash rate, while the device was
 * applying the per-karat table rate and its own markup. Carrying the preview's
 * own numbers over, rather than asking again or recomputing, is what keeps the
 * bill and the price the customer was quoted identical.
 *
 * The lines are rounded once (utils/moneyMath.buildInvoiceLines): the MRP the
 * card showed, half-up, shared out over the lines in whole rupees, so the
 * subtotal is that MRP — wastage included, on its own line.
 */
export function useInvoiceComputation(): InvoiceComputation {
  const scanData = useScannerStore((state) => state.scanData);
  const storedPricing = useScannerStore((state) => state.previewPricing);
  const previewOtherCharges = useScannerStore((state) => state.previewOtherCharges);
  const gstRate = useInvoiceStore((state) => state.gstRate);

  const selectedKarat = useMemo(
    () => resolveScannedKarat(scanData.karat, scanData.tunch) || '14K',
    [scanData.karat, scanData.tunch],
  );

  // Whatever the review screen last displayed — not a fresh request. Generate
  // Invoice is only reachable from a screen that publishes its pricing here, so
  // this is the figure the customer was just shown.
  const pricing = storedPricing ?? EMPTY_PRICING;

  // The other charges behind that pricing: a wishlist item's own when the
  // preview showed one, else the current scan's.
  const otherChargeItems = previewOtherCharges?.items ?? scanData.otherChargesItems ?? [];
  const otherChargeRemarks = previewOtherCharges?.remarks ?? scanData.otherChargesRemarks;

  const lineItemRows = useMemo(
    () =>
      buildInvoiceLines({
        karatNote: pricing.selectedKarat || selectedKarat,
        netWtGrams: pricing.netWtGrams,
        goldAmount: pricing.goldBasePrice,
        // Stone lines come wholly from the preview's own rows — description,
        // carats and amount together. Zipping them against a fresh read of
        // the scan let the two lists disagree in length.
        stones: pricing.stoneRows.map((stone) => ({
          stoneType: stone.stoneType,
          quality: stone.quality,
          carats: parseWeightValue(stone.weight),
          amount: stone.amount,
        })),
        labourAmount: pricing.labourAmount,
        wastage: {
          grams: pricing.wastageWeightGrams ?? 0,
          ratePerGram: pricing.goldRatePerGram,
          percent: pricing.wastagePercent ?? 0,
          amount: pricing.wastageAmount ?? 0,
        },
        otherCharges: {
          items: otherChargeItems,
          remarks: otherChargeRemarks,
          total: pricing.otherChargesAmount,
        },
        mrp: pricing.ultimateMrp,
      }),
    [pricing, selectedKarat, otherChargeItems, otherChargeRemarks],
  );

  // The subtotal is the sum of the printed lines, which is the MRP the card
  // showed, rounded.
  const subtotal = useMemo(() => sumLineAmounts(lineItemRows), [lineItemRows]);
  const gstAmount = useMemo(() => computeGstAmount(subtotal, gstRate), [subtotal, gstRate]);
  const grandTotal = useMemo(
    () => computeGrandTotal(subtotal, gstAmount),
    [subtotal, gstAmount],
  );
  const grandTotalWords = useMemo(() => amountInWords(grandTotal), [grandTotal]);

  return {
    lineItemRows,
    subtotal,
    gstRate,
    gstAmount,
    grandTotal,
    grandTotalWords,
    ratesLoaded: pricing.ultimateMrp > 0,
  };
}
