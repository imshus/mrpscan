import { useMemo } from 'react';

import { useInvoiceStore } from '@/store/invoiceStore';
import { useScannerStore } from '@/store/scannerStore';
import {
  buildOtherChargeLineItemRows,
  computeGrandTotal,
  computeGstAmount,
  type InvoiceLineItemRow,
} from '@/utils/invoiceCalculation';
import { amountInWords } from '@/utils/numberToWords';
import { parseWeightValue, resolveScannedKarat } from '@/utils/formulaUtils';
import {
  formatIndianCurrency,
  parseNumericValue,
  type FinalTabPricingResult,
} from '@/utils/scanPriceCalculation';

/**
 * Whole rupees, matching formatIndianCurrency — the scanner preview rounds
 * every figure it shows, so the invoice has to bill the same rounded number.
 */
function roundToRupee(amount: number): number {
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

/** Zero pricing, used only if the invoice is opened without a preview behind it. */
const EMPTY_PRICING: Pick<
  FinalTabPricingResult,
  'netWtGrams' | 'goldBasePrice' | 'selectedKarat' | 'stoneRows' | 'labourAmount' | 'ultimateMrp'
> = {
  netWtGrams: 0,
  goldBasePrice: 0,
  selectedKarat: '',
  stoneRows: [],
  labourAmount: 0,
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
 */
export function useInvoiceComputation(): InvoiceComputation {
  const scanData = useScannerStore((state) => state.scanData);
  const storedPricing = useScannerStore((state) => state.previewPricing);
  const gstRate = useInvoiceStore((state) => state.gstRate);

  const selectedKarat = useMemo(
    () => resolveScannedKarat(scanData.karat, scanData.tunch) || '14K',
    [scanData.karat, scanData.tunch],
  );

  // Whatever the review screen last displayed — not a fresh request. Generate
  // Invoice is only reachable from a screen that publishes its pricing here, so
  // this is the figure the customer was just shown.
  const pricing = storedPricing ?? EMPTY_PRICING;

  const lineItemRows = useMemo(() => {
    const netWtGrams = pricing.netWtGrams;
    // The preview screen prints whole rupees, so the invoice has to bill whole
    // rupees — an amount of 9,849.60 next to a quoted ₹9,850 is the customer
    // reading two prices for one piece.
    const goldAmount = roundToRupee(pricing.goldBasePrice);
    const goldRow: InvoiceLineItemRow = {
      key: 'gold-base-metal',
      description: 'Gold (in grams)',
      note: pricing.selectedKarat || selectedKarat || '—',
      qty: netWtGrams,
      qtyUnit: 'g',
      // Derived from the amount so the printed Qty × Price closes to it.
      price: netWtGrams > 0 ? goldAmount / netWtGrams : 0,
      amount: goldAmount,
    };

    // Stone lines come wholly from the preview's own rows — description, carats,
    // rate and amount together. Zipping them against a fresh read of the scan
    // let the two lists disagree in length: a stone the preview had priced could
    // be dropped from the bill, or an amount could land on another stone's line.
    const stoneRows: InvoiceLineItemRow[] = pricing.stoneRows.map((stone, index) => ({
      key: `stone-${stone.stoneType}-${index}`,
      description:
        stone.stoneType === 'diamond' ? 'Diamond (in carats)' : 'Colorstone (in carats)',
      note: stone.quality && stone.quality !== '—' ? stone.quality : '',
      qty: parseWeightValue(stone.weight),
      qtyUnit: 'Ct',
      price: parseNumericValue(stone.rate),
      amount: roundToRupee(stone.amount),
    }));

    const labourAmount = roundToRupee(pricing.labourAmount);
    const labourRow: InvoiceLineItemRow | null =
      labourAmount > 0
        ? {
            key: 'labour-charge',
            description: 'Labour Charge',
            note: formatIndianCurrency(labourAmount),
            qty: 1,
            qtyUnit: '',
            price: labourAmount,
            amount: labourAmount,
          }
        : null;

    const otherChargeRows = buildOtherChargeLineItemRows(
      scanData.otherChargesItems || [],
      scanData.otherChargesRemarks,
    ).map((row) => {
      const amount = roundToRupee(row.amount);
      return { ...row, price: amount, amount };
    });

    return [
      goldRow,
      ...stoneRows,
      ...(labourRow ? [labourRow] : []),
      ...otherChargeRows,
    ];
  }, [pricing, selectedKarat, scanData]);

  // The subtotal is the sum of the printed lines, not the unrounded MRP, so
  // the amount column on paper actually adds up to the figure beneath it.
  const subtotal = useMemo(
    () => lineItemRows.reduce((sum, row) => sum + row.amount, 0),
    [lineItemRows],
  );
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
