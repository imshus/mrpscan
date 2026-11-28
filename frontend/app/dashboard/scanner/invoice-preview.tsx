import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { EstimatedInvoicePanel } from '@/components/invoice/EstimatedInvoicePanel';
import { InvoiceGenerationBilling } from '@/components/scanner/InvoiceGenerationBilling';
import { GradientView } from '@/components/ui/GradientView';
import { Colors, Gradients } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { getBusinessProfile } from '@/utils/businessProfile';
import { formatItemIdentity, resolveItemIdentity } from '@/utils/itemIdentity';
import { PrimaryGreenButton } from '@/components/scanner/PrimaryGreenButton';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { REFUSAL_BUZZ } from '@/constants/haptics';
import { CART_INVOICE_SOURCE, useCartInvoice } from '@/hooks/useCartInvoice';
import { useInvoiceComputation } from '@/hooks/useInvoiceComputation';
import type { InvoiceLineItemRow } from '@/utils/invoiceCalculation';
import { MessagePopup } from '@/components/settings/MessagePopup';
import { useInvoiceStore } from '@/store/invoiceStore';
import { useScannerStore } from '@/store/scannerStore';
import { parseStoneArraysFromStructuredData } from '@/utils/stoneSequenceUtils';

/** A cart with nothing checked out bills no lines (one array, so memos hold). */
const NO_LINES: InvoiceLineItemRow[] = [];

export default function InvoicePreviewScreen() {
  const router = useRouter();

  const scanData = useScannerStore((state) => state.scanData);
  const structuredData = useScannerStore((state) => state.structuredData);
  const scanId = useScannerStore((state) => state.scanId);

  const customer = useInvoiceStore((state) => state.customer);
  // GST Invoice (the customer form) or Estimated Invoice (the MRP Breakdown),
  // the two tabs the design puts at the top (owner, 28 Nov 2026).
  const [tab, setTab] = useState<'gst' | 'estimate'>('gst');
  const registration = useAuthStore((state) => state.registration);
  const [eInvoiceNote, setEInvoiceNote] = useState<string | null>(null);
  // Bumped when Preview is refused for a missing name or phone.
  const [missingTick, setMissingTick] = useState(0);

  // Opened from the cart's Generate Invoice: the cart's pieces are billed,
  // not the scanner's last scan.
  const { isCart, invoice: cartInvoice } = useCartInvoice();

  // One source of truth for the figures: the same hook the preview sheet and
  // the generated PDF read, so this screen can never guard on a total the
  // invoice would not print.
  const { grandTotal, lineItemRows } = useInvoiceComputation({
    lineItems: isCart ? (cartInvoice?.rows ?? NO_LINES) : undefined,
  });

  const { diamonds, colorstones } = useMemo(
    () => parseStoneArraysFromStructuredData(structuredData, scanData),
    [structuredData, scanData],
  );

  // Per the mockup, Preview Invoice opens the native tax-invoice sheet.
  // Nothing is generated here — the invoice number is consumed only when the
  // user presses Download on the preview.
  const validateBasics = (): boolean => {
    // A missing name or phone: no popup, at the owner's asking. The field
    // goes red with what it needs, takes the cursor, and the phone buzzes
    // once. The phone is held to the 10 digits its field asks for.
    if (!customer.customerName.trim() || customer.customerPhone.trim().length !== 10) {
      Vibration.vibrate(REFUSAL_BUZZ);
      setMissingTick((n) => n + 1);
      return false;
    }
    if (isCart && !cartInvoice) {
      Alert.alert('Cart is empty', 'Select tags in Wishlist and tap Add to cart, then generate the invoice.');
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
    if (isCart) {
      // The preview bills the same cart.
      router.push({
        pathname: '/dashboard/scanner/invoice-sheet',
        params: { source: CART_INVOICE_SOURCE },
      } as unknown as Href);
      return;
    }
    router.push('/dashboard/scanner/invoice-sheet' as Href);
  };

  // E-invoicing is not offered from the app yet: the government registration
  // is arranged with the team directly. The button says so in a popup that
  // stays until its cross is tapped, and does nothing else, at the shop's asking.
  const handleEInvoice = () => {
    // The shop's own wording, verbatim.
    setEInvoiceNote(
      'This feature Required Government regulation. Write Email for this feature, Our main team representative will connect with you shortly.',
    );
  };

  const estimateTitle = isCart
    ? `Cart · ${cartInvoice?.pieces.length ?? 0} pieces`
    : formatItemIdentity(resolveItemIdentity(scanData)) || scanData.sku?.trim() || 'Scanned item';

  return (
    <ScanScreenWrapper
      title="Invoice Generation"
      className="bg-surface-muted"
      footer={
        tab === 'gst' ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <PrimaryGreenButton title="Preview Invoice" onPress={handleGenerateInvoice} />
            <PrimaryGreenButton title="E-Invoice" onPress={handleEInvoice} />
          </View>
        ) : undefined
      }
    >
      <BackgroundPattern />

      <View style={styles.tabs}>
        {(['gst', 'estimate'] as const).map((key) => {
          const label = key === 'gst' ? 'GST Invoice' : 'Estimated Invoice';
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={styles.tab}
            >
              {active ? (
                <GradientView colors={Gradients.brand} forceGradient borderRadius={999} style={styles.tabActive}>
                  <Text style={[styles.tabText, styles.tabTextActive]}>{label}</Text>
                </GradientView>
              ) : (
                <View style={styles.tabIdle}>
                  <Text style={styles.tabText}>{label}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {tab === 'gst' ? (
        <InvoiceGenerationBilling
          scanData={scanData}
          structuredData={structuredData}
          diamonds={diamonds}
          colorstones={colorstones}
          scanId={scanId}
          missingTick={missingTick}
        />
      ) : (
        <EstimatedInvoicePanel
          rows={lineItemRows}
          title={estimateTitle}
          shopName={getBusinessProfile(registration).businessName}
        />
      )}

      <MessagePopup message={eInvoiceNote} onDismiss={() => setEInvoiceNote(null)} />
    </ScanScreenWrapper>
  );
}

const styles = StyleSheet.create({
  // The design's switch: a beige pill, the chosen half in the brand red.
  tabs: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    marginBottom: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
  },
  tab: { flex: 1 },
  tabActive: { paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  tabIdle: { paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white },
});
