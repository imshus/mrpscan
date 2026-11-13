import { useMemo } from 'react';

import { useAuthStore } from '@/store/authStore';
import { useInvoiceStore } from '@/store/invoiceStore';
import { useScannerStore } from '@/store/scannerStore';
import { getBusinessProfile } from '@/utils/businessProfile';
import { type InvoiceLineItemRow } from '@/utils/invoiceCalculation';
import { invoiceLinesInputFromPricing } from '@/utils/invoiceLines';
import {
  buildInvoiceLines,
  computeGrandTotal,
  computeInvoiceTax,
  isIntraStateSupplier,
  sumLineAmounts,
} from '@/utils/moneyMath';
import { amountInWords } from '@/utils/numberToWords';
import { resolveScannedKarat } from '@/utils/formulaUtils';
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
 *
 * GST is the server's own arithmetic (moneyMath.computeInvoiceTax): each line
 * taxed on its own, CGST + SGST for a Delhi (07) supplier, IGST otherwise.
 * `supplierGstin` is the shop's GSTIN as the server holds it, when the caller
 * has it; the signed-in profile's otherwise.
 *
 * `lineItems`, when given, are the invoice's lines already built — a cart's
 * pieces, each with its own lines (utils/cartInvoice.buildCartInvoice) — and
 * the scan's preview pricing is not read at all. The totals and GST are then
 * worked out on those lines exactly as on a single scan's.
 */
export function useInvoiceComputation(
  options: { supplierGstin?: string | null; lineItems?: InvoiceLineItemRow[] } = {},
): InvoiceComputation {
  const givenLines = options.lineItems;
  const registration = useAuthStore((state) => state.registration);
  const supplierGstin =
    options.supplierGstin?.trim() || getBusinessProfile(registration).gstNumber;
  const intraState = isIntraStateSupplier(supplierGstin);
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

  // The scan's lines, read from its pricing the way a cart reads each of its
  // pieces (utils/invoiceLines), so one piece bills the same alone or in a cart.
  const scanLineItemRows = useMemo(
    () =>
      buildInvoiceLines(
        invoiceLinesInputFromPricing(pricing, {
          karatFallback: selectedKarat,
          otherChargeItems,
          otherChargeRemarks,
        }),
      ),
    [pricing, selectedKarat, otherChargeItems, otherChargeRemarks],
  );
  const lineItemRows = givenLines ?? scanLineItemRows;

  // The subtotal is the sum of the printed lines, which is the MRP the card
  // showed, rounded.
  const subtotal = useMemo(() => sumLineAmounts(lineItemRows), [lineItemRows]);
  const gstAmount = useMemo(
    () => computeInvoiceTax(lineItemRows.map((row) => row.amount), gstRate, intraState).gst,
    [lineItemRows, gstRate, intraState],
  );
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
    // A cart's pieces were priced when they were saved; there is nothing
    // left to load once it has lines.
    ratesLoaded: givenLines ? givenLines.length > 0 : pricing.ultimateMrp > 0,
  };
}
