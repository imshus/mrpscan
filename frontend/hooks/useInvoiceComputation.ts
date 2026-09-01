import { useMemo } from 'react';

import { useFinalTabPricing } from '@/hooks/useFinalTabPricing';
import { useInvoiceStore } from '@/store/invoiceStore';
import { useScannerStore } from '@/store/scannerStore';
import {
  buildOtherChargeLineItemRows,
  buildStoneLineItemRows,
  computeGrandTotal,
  computeGstAmount,
  type InvoiceLineItemRow,
} from '@/utils/invoiceCalculation';
import { amountInWords } from '@/utils/numberToWords';
import { resolveScannedKarat } from '@/utils/formulaUtils';
import { formatIndianCurrency } from '@/utils/scanPriceCalculation';
import {
  buildDisplayStoneBlocks,
  parseStoneArraysFromStructuredData,
} from '@/utils/stoneSequenceUtils';

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
 * Every figure comes from the same backend MRP breakdown the scanner preview
 * screen displays, via the same hook. The invoice used to re-derive gold,
 * labour and the subtotal on the device with its own formulas, which disagreed
 * with the preview — the server prices gold as pure weight × the 24K RTGS/cash
 * rate, while the device was applying the per-karat table rate and its own
 * markup. Reading the breakdown instead of recomputing it is what keeps the
 * invoice and the price the customer was quoted identical.
 */
export function useInvoiceComputation(): InvoiceComputation {
  const scanData = useScannerStore((state) => state.scanData);
  const structuredData = useScannerStore((state) => state.structuredData);
  const selectedType = useScannerStore((state) => state.selectedType);
  const gstRate = useInvoiceStore((state) => state.gstRate);

  const selectedKarat = useMemo(
    () => resolveScannedKarat(scanData.karat, scanData.tunch) || '14K',
    [scanData.karat, scanData.tunch],
  );

  const pricing = useFinalTabPricing({
    scanData: { ...scanData, karat: selectedKarat },
    structuredData,
    selectedType,
    selectedKarat,
  });

  const { diamonds, colorstones } = useMemo(
    () => parseStoneArraysFromStructuredData(structuredData, scanData),
    [structuredData, scanData],
  );

  const lineItemRows = useMemo(() => {
    const netWtGrams = pricing.netWtGrams;
    const goldAmount = pricing.goldBasePrice;
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

    // Stone descriptions come from the scanned entries; the amounts come from
    // the same rows the preview screen prints, matched by position (both are
    // built from buildDisplayStoneBlocks, so the order is identical).
    const stoneBlocks = buildDisplayStoneBlocks(diamonds, colorstones);
    const stoneRows = buildStoneLineItemRows(
      stoneBlocks.map((block) => block.entry),
    ).map((row, index) => {
      const priced = pricing.stoneRows[index];
      return priced ? { ...row, amount: priced.amount } : row;
    });

    const labourRow: InvoiceLineItemRow | null =
      pricing.labourAmount > 0
        ? {
            key: 'labour-charge',
            description: 'Labour Charge',
            note: formatIndianCurrency(pricing.labourAmount),
            qty: 1,
            qtyUnit: '',
            price: pricing.labourAmount,
            amount: pricing.labourAmount,
          }
        : null;

    const otherChargeRows = buildOtherChargeLineItemRows(
      scanData.otherChargesItems || [],
      scanData.otherChargesRemarks,
    );

    return [
      goldRow,
      ...stoneRows,
      ...(labourRow ? [labourRow] : []),
      ...otherChargeRows,
    ];
  }, [pricing, selectedKarat, diamonds, colorstones, scanData]);

  // The scanner preview's MRP is the invoice subtotal, exactly.
  const subtotal = pricing.ultimateMrp;
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
