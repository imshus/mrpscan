import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Minus, Plus, Search } from 'lucide-react-native';

import { InvoiceSheet, type InvoiceSheetData } from '@/components/invoice/InvoiceSheet';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useInvoiceStore } from '@/store/invoiceStore';
import { useInvoiceComputation } from '@/hooks/useInvoiceComputation';
import { getBusinessProfile } from '@/utils/businessProfile';
import {
  apiFetchNextInvoiceNumber,
  apiGenerateInvoice,
  resolveInvoicePdfUrl,
  type GenerateInvoiceResponse,
  type InvoiceLineItemPayload,
} from '@/utils/invoiceApi';

const DEFAULT_TERMS = [
  'Goods once sold will not be taken back.',
  'Interest @ 18% p.a. will be charged if payment is delayed.',
  "Subject to 'Delhi' Jurisdiction only.",
];

const ZOOM_STEPS = [0.85, 1, 1.15, 1.3];

function todayStamp(): string {
  return new Date()
    .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .split('/')
    .join('-');
}

/**
 * Invoice Preview — the tax invoice rendered natively before anything is
 * generated. Download produces the real PDF (this is the moment an invoice
 * number is consumed); Share on WhatsApp sends the durable invoice link.
 */
export default function InvoiceSheetScreen() {
  const router = useRouter();
  const [zoomIndex, setZoomIndex] = useState(1);
  const [invoiceNumber, setInvoiceNumber] = useState('—');
  const [working, setWorking] = useState<null | 'download' | 'share'>(null);
  // One generation per visit: Share after Download (or vice versa) reuses it.
  const [generated, setGenerated] = useState<GenerateInvoiceResponse | null>(null);

  const registration = useAuthStore((state) => state.registration);
  const profile = getBusinessProfile(registration);

  const customer = useInvoiceStore((state) => state.customer);
  const placeOfSupply = useInvoiceStore((state) => state.placeOfSupply);
  const transport = useInvoiceStore((state) => state.transport);

  const {
    lineItemRows,
    subtotal,
    gstRate,
    gstAmount,
    grandTotal,
    grandTotalWords,
    ratesLoaded,
  } = useInvoiceComputation();

  useEffect(() => {
    let cancelled = false;
    apiFetchNextInvoiceNumber()
      .then((next) => {
        if (!cancelled && next) setInvoiceNumber(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const sheetData: InvoiceSheetData = useMemo(
    () => ({
      companyName: profile.businessName || 'Your Business',
      companyAddress: profile.address,
      companyGstin: profile.gstNumber,
      invoiceNumber: generated?.invoiceNumber ?? invoiceNumber,
      invoiceDate: generated?.invoiceDate ?? todayStamp(),
      placeOfSupply,
      reverseCharge: 'N',
      customerName: customer.customerName,
      customerAddress: customer.customerAddress,
      customerGstinOrPan: customer.customerGstin || customer.customerPan,
      lineItems: lineItemRows,
      subtotal,
      gstRate,
      gstAmount,
      grandTotal,
      amountInWords: grandTotalWords,
      terms: DEFAULT_TERMS,
    }),
    [
      profile,
      generated,
      invoiceNumber,
      placeOfSupply,
      customer,
      lineItemRows,
      subtotal,
      gstRate,
      gstAmount,
      grandTotal,
      grandTotalWords,
    ],
  );

  const generateOnce = async (): Promise<GenerateInvoiceResponse> => {
    if (generated) return generated;
    const lineItemsPayload: InvoiceLineItemPayload[] = lineItemRows.map((row) => ({
      description: row.description,
      note: row.note,
      qty: row.qty,
      qty_unit: row.qtyUnit === 'g' ? 'Gms.' : row.qtyUnit === 'Ct' ? 'CT' : row.qtyUnit,
      price: row.price,
      amount: row.amount,
    }));
    const result = await apiGenerateInvoice({
      customer_name: customer.customerName,
      customer_address: customer.customerAddress,
      customer_phone: customer.customerPhone,
      customer_email: customer.customerEmail,
      customer_gstin: customer.customerGstin,
      customer_pan: customer.customerPan,
      place_of_supply: placeOfSupply,
      transport,
      line_items: lineItemsPayload,
      subtotal,
      gst_rate: gstRate,
      gst_amount: gstAmount,
      grand_total: grandTotal,
      amount_in_words: grandTotalWords,
      terms_and_conditions: '',
    });
    setGenerated(result);
    return result;
  };

  const guardTotals = (): boolean => {
    if (grandTotal <= 0) {
      Alert.alert(
        'Rates not ready',
        'Gold rates have not loaded yet, so the invoice total would be zero. Please wait a moment and try again.',
      );
      return false;
    }
    return true;
  };

  const handleDownload = async () => {
    if (!guardTotals() || working) return;
    setWorking('download');
    try {
      const result = await generateOnce();
      router.push({
        pathname: '/dashboard/scanner/print-invoice',
        params: {
          pdfUrl: resolveInvoicePdfUrl(result),
          invoiceNumber: result.invoiceNumber,
          invoiceDate: result.invoiceDate,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Invoice generation failed. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setWorking(null);
    }
  };

  const handleShare = async () => {
    if (!guardTotals() || working) return;
    setWorking('share');
    try {
      const result = await generateOnce();
      const link = result.invoiceUrl || result.pdfUrl;
      const text =
        `Invoice ${result.invoiceNumber} from ${profile.businessName || 'us'} — ` +
        `₹ ${Math.round(grandTotal).toLocaleString('en-IN')}\n${link}`;
      await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() =>
        Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not share the invoice. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setWorking(null);
    }
  };

  const zoom = ZOOM_STEPS[zoomIndex];

  return (
    <ScanScreenWrapper
      title="Invoice Preview"
      className="bg-surface-muted"
      scanButtonVariant="green"
      footer={
        <View style={styles.footerRow}>
          <Pressable
            onPress={handleShare}
            disabled={working !== null}
            style={[styles.footerBtn, styles.shareBtn]}
          >
            {working === 'share' ? (
              <ActivityIndicator size={16} color={Colors.white} />
            ) : null}
            <Text style={styles.footerBtnText}>Share on WhatsApp</Text>
          </Pressable>
          <Pressable
            onPress={handleDownload}
            disabled={working !== null}
            style={[styles.footerBtn, styles.downloadBtn]}
          >
            {working === 'download' ? (
              <ActivityIndicator size={16} color={Colors.white} />
            ) : null}
            <Text style={styles.footerBtnText}>Download</Text>
          </Pressable>
        </View>
      }
    >
      {!ratesLoaded && grandTotal <= 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Preparing preview…</Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal={zoom > 1}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sheetWrap}
          >
            <View style={{ width: zoom > 1 ? `${zoom * 100}%` : '100%' }}>
              <InvoiceSheet data={sheetData} />
            </View>
          </ScrollView>

          {/* Zoom bar, as in the mockup: − / magnifier / + */}
          <View style={styles.zoomBar}>
            <Pressable
              onPress={() => setZoomIndex((current) => Math.max(0, current - 1))}
              style={styles.zoomBtn}
              accessibilityLabel="Zoom out"
            >
              <Minus size={16} color={Colors.textPrimary} />
            </Pressable>
            <Search size={16} color={Colors.textMuted} />
            <Pressable
              onPress={() =>
                setZoomIndex((current) => Math.min(ZOOM_STEPS.length - 1, current + 1))
              }
              style={styles.zoomBtn}
              accessibilityLabel="Zoom in"
            >
              <Plus size={16} color={Colors.textPrimary} />
            </Pressable>
          </View>
        </>
      )}
    </ScanScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { alignItems: 'center', gap: 10, paddingVertical: 60 },
  loadingText: { fontSize: 13, color: Colors.textSecondary },
  sheetWrap: { paddingTop: 4, paddingBottom: 8, flexGrow: 1 },
  zoomBar: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  zoomBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4EFE3',
  },
  footerRow: { flexDirection: 'row', gap: 10 },
  footerBtn: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareBtn: { backgroundColor: '#1FA855' },
  downloadBtn: { backgroundColor: Colors.brandDeep },
  footerBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
