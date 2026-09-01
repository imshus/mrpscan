import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { FileText } from 'lucide-react-native';

import { InvoiceGenerationBilling } from '@/components/scanner/InvoiceGenerationBilling';
import { PrimaryGreenButton } from '@/components/scanner/PrimaryGreenButton';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { useInvoiceStore } from '@/store/invoiceStore';
import { useScannerStore } from '@/store/scannerStore';
import type { GoldRate } from '@/types/rates';
import {
  buildGoldLineItemRow,
  buildOtherChargeLineItemRows,
  buildStoneLineItemRows,
  computeGrandTotal,
  computeGstAmount,
  computeInvoiceSubtotal,
  prepareDisplayGoldRates,
} from '@/utils/invoiceCalculation';
import { resolveScannedKarat } from '@/utils/formulaUtils';
import { parseStoneArraysFromStructuredData } from '@/utils/stoneSequenceUtils';
import { buildDisplayStoneBlocks } from '@/utils/stoneSequenceUtils';
import { fetchGoldRates } from '@/utils/ratesApi';
import { resolveMcxChangeValue } from '@/utils/goldRateUtils';

export default function InvoicePreviewScreen() {
  const router = useRouter();
  const [goldRates, setGoldRates] = useState<GoldRate[]>([]);
  const [mcxLiveRate, setMcxLiveRate] = useState(0);
  const [mcxFinalRate, setMcxFinalRate] = useState(0);
  const [supremeRtgsChange, setSupremeRtgsChange] = useState(0);
  const [supremeCashChange, setSupremeCashChange] = useState(0);
  const [rtgsChange, setRtgsChange] = useState(0);
  const [cashChange, setCashChange] = useState(0);

  const scanData = useScannerStore((state) => state.scanData);
  const structuredData = useScannerStore((state) => state.structuredData);
  const scanId = useScannerStore((state) => state.scanId);

  // Invoice form state
  const customer = useInvoiceStore((state) => state.customer);
  const placeOfSupply = useInvoiceStore((state) => state.placeOfSupply);
  const gstRate = useInvoiceStore((state) => state.gstRate);

  // Fetch gold rates (same as InvoiceGenerationBilling)
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
          response.taxSettings?.mcxFinalRate ??
          response.mcxLiveRate + mcxChangeBy,
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
      });
    return () => { cancelled = true; };
  }, []);

  const { diamonds, colorstones } = useMemo(
    () => parseStoneArraysFromStructuredData(structuredData, scanData),
    [structuredData, scanData],
  );

  const selectedKarat = useMemo(
    () => resolveScannedKarat(scanData.karat, scanData.tunch) || '14K',
    [scanData.karat, scanData.tunch],
  );

  // Build line items (same logic as InvoiceGenerationBilling)
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
    const stoneEntries = stoneBlocks.map((b) => b.entry);
    const stoneRows = buildStoneLineItemRows(stoneEntries);
    const otherChargeRows = buildOtherChargeLineItemRows(
      scanData.otherChargesItems || [],
      scanData.otherChargesRemarks,
    );
    return [goldRow, ...stoneRows, ...otherChargeRows];
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
    scanData.otherChargesItems,
  ]);

  const subtotal = useMemo(() => computeInvoiceSubtotal(lineItemRows), [lineItemRows]);
  const gstAmount = useMemo(() => computeGstAmount(subtotal, gstRate), [subtotal, gstRate]);
  const grandTotal = useMemo(() => computeGrandTotal(subtotal, gstAmount), [subtotal, gstAmount]);

  // Per the mockup, Preview Invoice opens the native tax-invoice sheet.
  // Nothing is generated here — the invoice number is consumed only when the
  // user presses Download on the preview.
  const handleGenerateInvoice = () => {
    if (!customer.customerName.trim()) {
      Alert.alert('Missing Info', 'Please enter the customer name before generating.');
      return;
    }
    if (!customer.customerPhone.trim()) {
      Alert.alert('Missing Info', 'Please enter the customer phone number before generating.');
      return;
    }
    // Gold rates load asynchronously; previewing a zero-value invoice helps no one.
    if (grandTotal <= 0) {
      Alert.alert(
        'Rates not ready',
        'Gold rates have not loaded yet, so the invoice total would be zero. Please wait a moment and try again.',
      );
      return;
    }

    router.push('/dashboard/scanner/invoice-sheet' as Href);
  };

  return (
    <ScanScreenWrapper
      title="Invoice Generation"
      className="bg-surface-muted"
      scanButtonVariant="green"
      footer={
        <PrimaryGreenButton title="Preview Invoice" onPress={handleGenerateInvoice} />
      }
    >
      <BackgroundPattern />

      <InvoiceGenerationBilling
        scanData={scanData}
        structuredData={structuredData}
        diamonds={diamonds}
        colorstones={colorstones}
        scanId={scanId}
      />
    </ScanScreenWrapper>
  );
}
