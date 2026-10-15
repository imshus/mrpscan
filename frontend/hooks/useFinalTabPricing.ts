import { useState, useEffect, useMemo, useRef } from 'react';
import type { GoldRate } from '@/types/rates';
import type { JewelleryType, ScanItemData, StructuredScanData, CalculateMrpPayload, CalculateMrpResponse } from '@/types/scanner';
import { resolveScannedKarat } from '@/utils/formulaUtils';
import { buildDisplayStoneBlocks, parseStoneArraysFromStructuredData } from '@/utils/stoneSequenceUtils';
import {
  computeLabourAmount,
  computeOtherChargesTotal,
  computeStoneAmountWithDiscount,
  formatIndianCurrency,
  formatWeightGrams,
  parseNumericValue,
  type FinalTabPricingResult,
  type StoneAmountRow,
} from '@/utils/scanPriceCalculation';
import { parseWeightValue } from '@/utils/formulaUtils';
import { calculateScanMrp } from '@/utils/scanApi';
import { derivePricingInput, takePrefetchedPricing, takeServerPricing } from '@/utils/pricingPrefetch';
import { ApiError } from '@/utils/apiClient';
import { useScannerStore } from '@/store/scannerStore';

export interface UseFinalTabPricingOptions {
  scanData: ScanItemData;
  structuredData?: StructuredScanData;
  selectedType: JewelleryType;
  goldRates?: GoldRate[];
  selectedKarat?: string;
}

// Fallback empty state while loading
const defaultPricing: FinalTabPricingResult = {
  grossWtDisplay: '—',
  netWtGrams: 0,
  netWtDisplay: '—',
  selectedKarat: '18K',
  effectivePurityPercent: 0,
  puritySource: 'karatMapping',
  pureWtGrams: 0,
  pureWtDisplay: '—',
  goldRatePerGram: 0,
  goldBasePrice: 0,
  goldBasePriceDisplay: '₹0',
  stoneRows: [],
  totalStoneAmount: 0,
  diamondAmount: 0,
  colorstoneAmount: 0,
  labourInputMode: 'none',
  usePercentageMode: false,
  useFixedAmountMode: false,
  labourAmount: 0,
  labourDisplay: '—',
  wastageCode: '',
  wastagePercent: 0,
  wastageAmount: 0,
  wastageDisplay: '—',
  otherChargesAmount: 0,
  otherChargesDisplay: '—',
  ultimateMrp: 0,
  ultimateMrpDisplay: '₹0',
};

const PRICING_EDIT_DEBOUNCE_MS = 350;

function buildPricingStateKey(pricing: FinalTabPricingResult): string {
  return JSON.stringify({
    grossWtDisplay: pricing.grossWtDisplay,
    netWtGrams: pricing.netWtGrams,
    selectedKarat: pricing.selectedKarat,
    effectivePurityPercent: pricing.effectivePurityPercent,
    pureWtGrams: pricing.pureWtGrams,
    goldRatePerGram: pricing.goldRatePerGram,
    goldBasePrice: pricing.goldBasePrice,
    totalStoneAmount: pricing.totalStoneAmount,
    diamondAmount: pricing.diamondAmount,
    colorstoneAmount: pricing.colorstoneAmount,
    labourAmount: pricing.labourAmount,
    wastageCode: pricing.wastageCode,
    wastagePercent: pricing.wastagePercent,
    wastageAmount: pricing.wastageAmount,
    wastageWeightGrams: pricing.wastageWeightGrams,
    otherChargesAmount: pricing.otherChargesAmount,
    ultimateMrp: pricing.ultimateMrp,
    stoneRows: pricing.stoneRows,
  });
}

export function useFinalTabPricing({
  scanData,
  structuredData,
  selectedType,
  selectedKarat,
}: UseFinalTabPricingOptions): FinalTabPricingResult {
  const scanId = useScannerStore((s) => s.scanId);
  const mrpRefreshToken = useScannerStore((s) => s.mrpRefreshToken);
  const analysisPending = useScannerStore((s) => s.analysisPending);
  // Sent with every request (derivePricingInput reads it from the store), so
  // a change to it has to price again like any field.
  const tagIdentifiers = useScannerStore((s) => s.tagIdentifiers);
  const [pricing, setPricing] = useState<FinalTabPricingResult>(defaultPricing);

  const lastRequestKeyRef = useRef<string | null>(null);

  const calculationKey = useMemo(
    () => JSON.stringify({
      selectedType,
      selectedKarat,
      scanData: {
        karat: scanData.karat,
        tunch: scanData.tunch,
        netWt: scanData.netWt,
        grossWt: scanData.grossWt,
        labourChargeAmount: scanData.labourChargeAmount,
        labourChargeUnit: scanData.labourChargeUnit,
        labourWeightBasis: scanData.labourWeightBasis,
        labourPurityPercent: scanData.labourPurityPercent,
        calculationRate: scanData.calculationRate,
        customPurityPercent: scanData.customPurityPercent,
        otherChargesAmount: scanData.otherChargesAmount,
        otherChargesItems: scanData.otherChargesItems,
        otherChargesRemarks: scanData.otherChargesRemarks,
        diamondWeight: scanData.diamondWeight,
        diamondRate: scanData.diamondRate,
        colorstoneWeight: scanData.colorstoneWeight,
        colorstoneRate: scanData.colorstoneRate,
        // Wastage is priced from these: a typed percent, a picked wastage
        // code (its percent), and the item the server looks the wastage up
        // by. Left out, an edit to any of them never re-priced the card.
        wastagePercent: scanData.wastagePercent,
        wastageCode: scanData.wastageCode,
        itemCode: scanData.itemCode,
        sku: scanData.sku,
      },
      tagIdentifiers,
      structuredData: {
        diamonds: structuredData?.diamonds ?? '',
        colorstones: structuredData?.colorstones ?? '',
        packetCode: structuredData?.packetCode ?? '',
        diamondWeight: structuredData?.diamondWeight ?? '',
        diamondRate: structuredData?.diamondRate ?? '',
        colorstoneWeight: structuredData?.colorstoneWeight ?? '',
        colorstoneRate: structuredData?.colorstoneRate ?? '',
      },
    }),
    [
      selectedType,
      selectedKarat,
      scanData.karat,
      scanData.tunch,
      scanData.netWt,
      scanData.grossWt,
      scanData.labourChargeAmount,
      scanData.labourChargeUnit,
      scanData.labourWeightBasis,
      scanData.labourPurityPercent,
      scanData.calculationRate,
      scanData.customPurityPercent,
      scanData.otherChargesAmount,
      scanData.otherChargesItems,
      scanData.otherChargesRemarks,
      scanData.diamondWeight,
      scanData.diamondRate,
      scanData.colorstoneWeight,
      scanData.colorstoneRate,
      scanData.wastagePercent,
      scanData.wastageCode,
      scanData.itemCode,
      scanData.sku,
      tagIdentifiers,
      structuredData?.diamonds,
      structuredData?.colorstones,
      structuredData?.packetCode,
      structuredData?.diamondWeight,
      structuredData?.diamondRate,
      structuredData?.colorstoneWeight,
      structuredData?.colorstoneRate,
    ],
  );

  // Shared with the processing screen's prefetch: identical state must yield
  // an identical payload there for its early request to be matched here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const calculationInput = useMemo(
    () => derivePricingInput(selectedType, scanData, structuredData, selectedKarat),
    [calculationKey],
  );

  useEffect(() => {
    // No point pricing an empty card; the real figures arrive with the result.
    if (!scanId || analysisPending) return;

    let isMounted = true;
    const requestKey = `${scanId}|${calculationKey}|${mrpRefreshToken}`;
    if (lastRequestKeyRef.current === requestKey) {
      return;
    }

    // The first calculation for a scan is the price shown when the preview
    // opens, so start it immediately. Only subsequent field edits need the
    // debounce that prevents a request on every keystroke.
    const isFirstRequestForScan = !lastRequestKeyRef.current?.startsWith(`${scanId}|`);
    lastRequestKeyRef.current = requestKey;

    const requestPricing = () => {
      const { diamonds, colorstones, payload, resolvedKarat } = calculationInput;

      // The processing screen starts the first calculation while its counter
      // runs, from exactly these inputs; when the payloads match, that answer
      // is normally in hand already and is the first price the card shows.
      const prefetched = isFirstRequestForScan
        ? takePrefetchedPricing(scanId, payload)
        : null;

      // The server also priced the reading inside the analysis, from its own
      // derivation of the inputs, which can differ from the card's. It is
      // shown only while the card's own price is still out.
      if (isFirstRequestForScan) {
        const seeded = takeServerPricing(scanId);
        const first = prefetched?.settled ?? seeded;
        if (first) {
          const firstPricing = toPricingResult(first);
          setPricing((current) =>
            buildPricingStateKey(current) === buildPricingStateKey(firstPricing) ? current : firstPricing,
          );
        }
        if (prefetched?.settled) return;
      }

      function toPricingResult(res: CalculateMrpResponse): FinalTabPricingResult {
        const stoneBlocks = buildDisplayStoneBlocks(diamonds, colorstones);
        const stoneRows: StoneAmountRow[] = stoneBlocks.map(block => {
            // As the request reads them (derivePricingInput): never below zero.
            const wt = Math.max(0, parseNumericValue(block.entry.weight));
            const rt = Math.max(0, parseNumericValue(block.entry.rate));
            const rowAmt =
              block.stoneType === 'diamond'
                ? computeStoneAmountWithDiscount(
                    block.entry.weight,
                    block.entry.rate,
                    block.entry.discountPercent,
                  )
                : wt * rt;
            return {
              sequenceIndex: block.sequenceIndex,
              displayTitle: block.displayTitle,
              stoneType: block.stoneType,
              rate: `₹${block.entry.rate}/ct`,
              quality: block.entry.quality || '—',
              weight: `${block.entry.weight} ct`,
                amount: rowAmt,
                amountDisplay: formatIndianCurrency(rowAmt),
            };
        });
        const discountedStoneTotal = stoneRows.reduce((sum, row) => sum + row.amount, 0);
        const diamondAmount = res.breakdown.diamondAmount;
        const colorstoneAmount = res.breakdown.colorstoneAmount;
        const backendStoneTotal = diamondAmount + colorstoneAmount;

        const grossWtGrams = parseWeightValue(scanData.grossWt);
        const netWtGrams = payload.netWt;
        const pureWeight = res.breakdown.pureWeight;
        const goldAmount = res.breakdown.goldAmount;
        const effectivePurityPercent =
          netWtGrams > 0 ? (pureWeight / netWtGrams) * 100 : 0;

        const puritySource = scanData.customPurityPercent.trim()
          ? 'tunchOverride'
          : 'karatMapping';

        const labour = computeLabourAmount(
          {
            labourPurityPercent: scanData.labourPurityPercent,
            labourChargeAmount: scanData.labourChargeAmount,
            labourChargeUnit: scanData.labourChargeUnit,
            labourWeightBasis: scanData.labourWeightBasis,
          },
          netWtGrams,
          grossWtGrams,
        );
        const backendLabourAmount = res.breakdown.labourAmount;
        const backendWastageAmount = Number(res.breakdown.wastageAmount) || 0;
        const backendOtherCharges = res.breakdown.otherCharges;
        const finalTotal = res.finalMRP;

        if (__DEV__) {
          console.info(
            '[MRP_UI_BREAKDOWN]',
            JSON.stringify({
              goldAmount,
              diamondAmount,
              colorstoneAmount,
              labourAmount: backendLabourAmount,
              otherChargesAmount: backendOtherCharges,
              subtotal: res.breakdown.subtotal,
              backendStoneTotal,
              uiStoneTotal: discountedStoneTotal,
              apiResponseTotal: res.finalMRP,
              displayedMrp: finalTotal,
              finalTotal,
            }),
          );
        }

        return {
          grossWtDisplay: scanData.grossWt || '—',
          netWtGrams,
          netWtDisplay: formatWeightGrams(netWtGrams),
          selectedKarat: resolvedKarat,
          effectivePurityPercent,
          puritySource,
          pureWtGrams: pureWeight,
          pureWtDisplay: formatWeightGrams(pureWeight),
          goldRatePerGram: res.breakdown.goldRateApplied,
          goldBasePrice: goldAmount,
          goldBasePriceDisplay: formatIndianCurrency(goldAmount),
          stoneRows,
          totalStoneAmount: backendStoneTotal,
          diamondAmount,
          colorstoneAmount,
          labourInputMode: labour.mode,
          usePercentageMode: labour.mode === 'percentage',
          useFixedAmountMode: labour.mode === 'fixedAmount',
          labourAmount: backendLabourAmount,
          labourDisplay: formatIndianCurrency(backendLabourAmount),
          // Priced from the item's own wastage, which only the server can
          // read; an item without one sends nothing and the tile stays blank.
          wastageCode: res.breakdown.wastageCode || '',
          wastagePercent: Number(res.breakdown.wastagePercent) || 0,
          wastageWeightGrams: Number(res.breakdown.wastageWeightGrams) || 0,
          wastageAmount: backendWastageAmount,
          wastageDisplay:
            backendWastageAmount > 0 ? formatIndianCurrency(backendWastageAmount) : '—',
          otherChargesAmount: backendOtherCharges,
          otherChargesDisplay: formatIndianCurrency(backendOtherCharges),
          ultimateMrp: finalTotal,
          ultimateMrpDisplay: formatIndianCurrency(finalTotal),
        };
      }

      (prefetched?.promise ?? calculateScanMrp(scanId, payload))
      .then((res: CalculateMrpResponse) => {
        if (!isMounted) return;
        const nextPricing = toPricingResult(res);
        setPricing((current) =>
          buildPricingStateKey(current) === buildPricingStateKey(nextPricing) ? current : nextPricing,
        );
      })
      .catch(err => {
        if (!isMounted) return;

        const isStaleScanError =
          err instanceof ApiError &&
          err.status === 404 &&
          /scan not found/i.test(err.message);

        if (isStaleScanError) {
          if (__DEV__) {
            console.info(
              '[MRP_CALC_SKIPPED]',
              JSON.stringify({
                reason: 'scan_not_found',
                scanId,
              }),
            );
          }
          return;
        }

        console.error('Failed to calculate MRP via backend', err);
      });
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isFirstRequestForScan) {
      requestPricing();
    } else {
      timer = setTimeout(requestPricing, PRICING_EDIT_DEBOUNCE_MS);
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [scanId, calculationKey, mrpRefreshToken, analysisPending]);

  return pricing;
}
