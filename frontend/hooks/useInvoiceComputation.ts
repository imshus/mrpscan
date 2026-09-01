import { useEffect, useMemo, useState } from 'react';

import { useInvoiceStore } from '@/store/invoiceStore';
import { useScannerStore } from '@/store/scannerStore';
import type { GoldRate } from '@/types/rates';
import {
  buildGoldLineItemRow,
  buildLabourLineItemRow,
  buildOtherChargeLineItemRows,
  buildStoneLineItemRows,
  computeGrandTotal,
  computeGstAmount,
  computeInvoiceSubtotal,
  prepareDisplayGoldRates,
  type InvoiceLineItemRow,
} from '@/utils/invoiceCalculation';
import { amountInWords } from '@/utils/numberToWords';
import { parseWeightValue, resolveScannedKarat } from '@/utils/formulaUtils';
import {
  buildDisplayStoneBlocks,
  parseStoneArraysFromStructuredData,
} from '@/utils/stoneSequenceUtils';
import { fetchGoldRates } from '@/utils/ratesApi';
import { resolveMcxChangeValue } from '@/utils/goldRateUtils';

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
 * The invoice's line items and totals, computed from the current scan and the
 * live gold rates. Shared by the Invoice Generation form and the native
 * Invoice Preview sheet so both always show identical figures.
 */
export function useInvoiceComputation(): InvoiceComputation {
  const [goldRates, setGoldRates] = useState<GoldRate[]>([]);
  const [mcxLiveRate, setMcxLiveRate] = useState(0);
  const [mcxFinalRate, setMcxFinalRate] = useState(0);
  const [supremeRtgsChange, setSupremeRtgsChange] = useState(0);
  const [supremeCashChange, setSupremeCashChange] = useState(0);
  const [rtgsChange, setRtgsChange] = useState(0);
  const [cashChange, setCashChange] = useState(0);
  const [ratesLoaded, setRatesLoaded] = useState(false);

  const scanData = useScannerStore((state) => state.scanData);
  const structuredData = useScannerStore((state) => state.structuredData);
  const gstRate = useInvoiceStore((state) => state.gstRate);

  useEffect(() => {
    let cancelled = false;
    fetchGoldRates()
      .then((response) => {
        if (cancelled) return;
        setGoldRates(response.rates);
        setMcxLiveRate(response.mcxLiveRate);
        const mcxChangeBy =
          response.taxSettings?.mcxChangeBy ??
          resolveMcxChangeValue(response.taxSettings?.mcxChange);
        setMcxFinalRate(
          response.taxSettings?.mcxFinalRate ?? response.mcxLiveRate + mcxChangeBy,
        );
        const supremeRtgsBase =
          response.supremeChanges?.supremeRtgs ??
          response.mcxLiveRate + (response.supremeChanges?.rtgsChange ?? 0);
        const supremeCashBase =
          response.supremeChanges?.supremeCash ??
          response.mcxLiveRate + (response.supremeChanges?.cashChange ?? 0);
        setSupremeRtgsChange(supremeRtgsBase - response.mcxLiveRate);
        setSupremeCashChange(supremeCashBase - response.mcxLiveRate);
        setRtgsChange(response.taxSettings?.rtgsChangeBy ?? 0);
        setCashChange(response.taxSettings?.cashChangeBy ?? 0);
        setRatesLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setGoldRates([]);
        setMcxLiveRate(0);
        setMcxFinalRate(0);
        setSupremeRtgsChange(0);
        setSupremeCashChange(0);
        setRtgsChange(0);
        setCashChange(0);
        setRatesLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { diamonds, colorstones } = useMemo(
    () => parseStoneArraysFromStructuredData(structuredData, scanData),
    [structuredData, scanData],
  );

  const selectedKarat = useMemo(
    () => resolveScannedKarat(scanData.karat, scanData.tunch) || '14K',
    [scanData.karat, scanData.tunch],
  );

  const lineItemRows = useMemo(() => {
    const { displayRates, activeBaseRate } = prepareDisplayGoldRates(
      goldRates,
      mcxLiveRate,
      supremeRtgsChange + rtgsChange,
      supremeCashChange + cashChange,
      scanData.calculationRate || 'rtgs',
      mcxFinalRate,
    );
    const goldRow = buildGoldLineItemRow({
      scanData,
      goldRates: displayRates,
      activeBaseRate,
      selectedKarat,
    });
    const stoneBlocks = buildDisplayStoneBlocks(diamonds, colorstones);
    const stoneEntries = stoneBlocks.map((block) => block.entry);
    const stoneRows = buildStoneLineItemRows(stoneEntries);
    const otherChargeRows = buildOtherChargeLineItemRows(
      scanData.otherChargesItems || [],
      scanData.otherChargesRemarks,
    );
    // Labour is part of the quoted MRP, so it belongs on the invoice and in
    // its subtotal; leaving it out billed the customer less than the scanner
    // had shown them.
    const labourRow = buildLabourLineItemRow(
      scanData,
      parseWeightValue(scanData.netWt),
      parseWeightValue(scanData.grossWt),
    );
    return [
      goldRow,
      ...stoneRows,
      ...(labourRow ? [labourRow] : []),
      ...otherChargeRows,
    ];
  }, [
    goldRates,
    mcxLiveRate,
    mcxFinalRate,
    supremeRtgsChange,
    supremeCashChange,
    rtgsChange,
    cashChange,
    scanData,
    selectedKarat,
    diamonds,
    colorstones,
  ]);

  const subtotal = useMemo(() => computeInvoiceSubtotal(lineItemRows), [lineItemRows]);
  const gstAmount = useMemo(() => computeGstAmount(subtotal, gstRate), [subtotal, gstRate]);
  const grandTotal = useMemo(
    () => computeGrandTotal(subtotal, gstAmount),
    [subtotal, gstAmount],
  );
  const grandTotalWords = useMemo(() => amountInWords(grandTotal), [grandTotal]);

  return { lineItemRows, subtotal, gstRate, gstAmount, grandTotal, grandTotalWords, ratesLoaded };
}
