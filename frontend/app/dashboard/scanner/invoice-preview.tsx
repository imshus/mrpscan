import { useMemo } from 'react';
import { Alert } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { InvoiceGenerationBilling } from '@/components/scanner/InvoiceGenerationBilling';
import { PrimaryGreenButton } from '@/components/scanner/PrimaryGreenButton';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { useInvoiceComputation } from '@/hooks/useInvoiceComputation';
import { useInvoiceStore } from '@/store/invoiceStore';
import { useScannerStore } from '@/store/scannerStore';
import { parseStoneArraysFromStructuredData } from '@/utils/stoneSequenceUtils';

export default function InvoicePreviewScreen() {
  const router = useRouter();

  const scanData = useScannerStore((state) => state.scanData);
  const structuredData = useScannerStore((state) => state.structuredData);
  const scanId = useScannerStore((state) => state.scanId);

  const customer = useInvoiceStore((state) => state.customer);

  // One source of truth for the figures: the same hook the preview sheet and
  // the generated PDF read, so this screen can never guard on a total the
  // invoice would not print.
  const { grandTotal } = useInvoiceComputation();

  const { diamonds, colorstones } = useMemo(
    () => parseStoneArraysFromStructuredData(structuredData, scanData),
    [structuredData, scanData],
  );

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
