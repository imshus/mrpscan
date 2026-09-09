import { useMemo } from 'react';
import { Alert, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { InvoiceGenerationBilling } from '@/components/scanner/InvoiceGenerationBilling';
import { PrimaryGreenButton } from '@/components/scanner/PrimaryGreenButton';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { useInvoiceComputation } from '@/hooks/useInvoiceComputation';
import { fetchEInvoiceSettings } from '@/utils/businessProfileApi';
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
  const validateBasics = (): boolean => {
    if (!customer.customerName.trim()) {
      Alert.alert('Missing Info', 'Please enter the customer name before generating.');
      return false;
    }
    if (!customer.customerPhone.trim()) {
      Alert.alert('Missing Info', 'Please enter the customer phone number before generating.');
      return false;
    }
    // Gold rates load asynchronously; previewing a zero-value invoice helps no one.
    if (grandTotal <= 0) {
      Alert.alert(
        'Rates not ready',
        'Gold rates have not loaded yet, so the invoice total would be zero. Please wait a moment and try again.',
      );
      return false;
    }
    return true;
  };

  const handleGenerateInvoice = () => {
    if (!validateBasics()) return;
    router.push('/dashboard/scanner/invoice-sheet' as Href);
  };

  // Same sheet, but the government registration needs a buyer GSTIN —
  // e-invoicing exists only for B2B bills — and the shop's own IRP
  // credentials, without which nothing can be signed. Both are checked at
  // the door, so a QR-less document never comes as a surprise.
  const handleEInvoice = async () => {
    if (!validateBasics()) return;
    if (customer.customerGstin.trim().length !== 15) {
      Alert.alert(
        'E-Invoice',
        'E-invoicing applies to B2B bills: enter the customer\'s 15-character GST number first.',
      );
      return;
    }
    const settings = await fetchEInvoiceSettings();
    // Test mode needs no credentials: it prints a labelled specimen band.
    if (settings?.mode !== 'test' && !settings?.enabled) {
      Alert.alert(
        'E-Invoicing not set up',
        'The signed QR comes from the government IRP, which needs your IRP API credentials. Save them under Business Profile → E-Invoicing and switch on Register B2B invoices.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Open Business Profile', onPress: () => router.push('/dashboard/business-profile' as Href) },
        ],
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
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <PrimaryGreenButton title="Preview Invoice" onPress={handleGenerateInvoice} />
          <PrimaryGreenButton title="E-Invoice" onPress={handleEInvoice} />
        </View>
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
