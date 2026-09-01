import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  Pressable,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Minus, Plus, Search } from 'lucide-react-native';

import { InvoiceHtmlSheet } from '@/components/invoice/InvoiceHtmlSheet';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { useInvoiceStore } from '@/store/invoiceStore';
import { useScannerStore } from '@/store/scannerStore';
import { useInvoiceComputation } from '@/hooks/useInvoiceComputation';
import { getBusinessProfile } from '@/utils/businessProfile';
import { formatItemIdentity, resolveItemIdentity } from '@/utils/itemIdentity';
import { fetchBusinessProfile, type BusinessProfileResponse } from '@/utils/businessProfileApi';
import {
  apiFetchNextInvoiceNumber,
  apiGenerateInvoice,
  fetchInvoicePreviewHtml,
  reserveInvoiceQr,
  resolveInvoicePdfUrl,
  type GenerateInvoiceResponse,
  type ReservedInvoiceQr,
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
 * generated.
 *
 * Download generates the PDF (the moment an invoice number is consumed) and
 * writes it into a folder the user chooses; Share on WhatsApp sends the
 * durable invoice link instead.
 */
export default function InvoiceSheetScreen() {
  const [zoomIndex, setZoomIndex] = useState(1);
  // The sheet sits inside the wrapper's ScrollView, where flex:1 collapses, so
  // its height is taken from the window instead of the parent.
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.max(520, Math.round(windowHeight * 0.74));
  const [invoiceNumber, setInvoiceNumber] = useState('—');
  const [working, setWorking] = useState<null | 'download' | 'share'>(null);
  // One generation per visit: Share after Download (or vice versa) reuses it.
  const [generated, setGenerated] = useState<GenerateInvoiceResponse | null>(null);
  // Reserved when the preview opens, so the QR on screen is the PDF's QR.
  const [reservedQr, setReservedQr] = useState<ReservedInvoiceQr | null>(null);
  // The invoice rendered by the server from the template the PDF uses.
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const registration = useAuthStore((state) => state.registration);
  const profile = getBusinessProfile(registration);
  // Bank details and terms live only on the server, so the preview reads
  // them rather than printing a footer the generated PDF will not match.
  const [business, setBusiness] = useState<BusinessProfileResponse | null>(null);

  const scanData = useScannerStore((state) => state.scanData);
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
    void fetchBusinessProfile().then((fresh) => {
      if (!cancelled && fresh) setBusiness(fresh);
    });
    // Reserve the token now so the preview shows the same QR the PDF prints.
    void reserveInvoiceQr().then((reserved) => {
      if (!cancelled && reserved) setReservedQr(reserved);
    });
    apiFetchNextInvoiceNumber()
      .then((next) => {
        if (!cancelled && next) setInvoiceNumber(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // The scanned piece, so the invoice says which item it bills for.
  const itemLabel = useMemo(
    () => formatItemIdentity(resolveItemIdentity(scanData)),
    [scanData],
  );

  const totalUnits = useMemo(
    () =>
      lineItemRows
        .filter((row) => /^(g|gm|gms|gram|grams)\.?$/i.test(row.qtyUnit.trim()))
        .reduce((sum, row) => sum + row.qty, 0)
        .toFixed(3),
    [lineItemRows],
  );

  // One payload for both paths: the preview renders it and generation sends
  // it, so what is shown cannot differ from what is billed.
  const invoicePayload = useMemo(
    () => ({
      customer_name: customer.customerName,
      customer_address: customer.customerAddress,
      customer_phone: customer.customerPhone,
      customer_email: customer.customerEmail,
      customer_gstin: customer.customerGstin,
      customer_pan: customer.customerPan,
      place_of_supply: placeOfSupply,
      transport,
      line_items: lineItemRows.map((row, index) => ({
        description: row.description,
        // The scanned piece is named on the first line.
        note: index === 0 && itemLabel && !row.note ? itemLabel : row.note,
        qty: row.qty,
        qty_unit: row.qtyUnit === 'g' ? 'Gms.' : row.qtyUnit === 'Ct' ? 'CT' : row.qtyUnit,
        price: row.price,
        amount: row.amount,
      })) as InvoiceLineItemPayload[],
      subtotal,
      gst_rate: gstRate,
      gst_amount: gstAmount,
      grand_total: grandTotal,
      amount_in_words: grandTotalWords,
      terms_and_conditions: '',
      public_token: reservedQr?.publicToken,
    }),
    [
      customer,
      placeOfSupply,
      transport,
      lineItemRows,
      itemLabel,
      subtotal,
      gstRate,
      gstAmount,
      grandTotal,
      grandTotalWords,
      reservedQr,
    ],
  );

  // Render the invoice from the server template whenever the figures change.
  useEffect(() => {
    if (grandTotal <= 0) return;
    let cancelled = false;
    void fetchInvoicePreviewHtml({ ...invoicePayload, invoice_number: invoiceNumber })
      .then((html) => {
        if (!cancelled && html) setPreviewHtml(html);
      });
    return () => {
      cancelled = true;
    };
  }, [invoicePayload, invoiceNumber, grandTotal]);

  const generateOnce = async (): Promise<GenerateInvoiceResponse> => {
    if (generated) return generated;
    const result = await apiGenerateInvoice(invoicePayload);
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

  /**
   * Generates the invoice and writes the PDF into a folder the user picks, so
   * it lands in their own storage rather than reopening the document on screen.
   */
  const handleDownload = async () => {
    if (!guardTotals() || working) return;
    setWorking('download');
    try {
      const result = await generateOnce();
      const fileName = `Invoice-${String(result.invoiceNumber).replace(/[^\w.-]+/g, '-')}.pdf`;

      // Fetch into app storage first: a failed download must not leave an
      // empty file sitting in the user's folder.
      const cached = `${FileSystem.cacheDirectory ?? ''}${fileName}`;
      const downloaded = await FileSystem.downloadAsync(resolveInvoicePdfUrl(result), cached);
      if (downloaded.status !== 200) {
        throw new Error(`Could not fetch the invoice (HTTP ${downloaded.status}).`);
      }

      const permission =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Saved in the app',
          `${fileName} was downloaded but not copied out, because no folder was chosen. Tap Download again to pick one.`,
        );
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(downloaded.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const target = await FileSystem.StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        fileName,
        'application/pdf',
      );
      await FileSystem.writeAsStringAsync(target, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      Alert.alert('Downloaded', `${fileName} has been saved to the folder you chose.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Invoice download failed. Please try again.';
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
          <View style={styles.sheetWrap}>
            <View style={[styles.sheetFill, { height: sheetHeight }]}>
              <InvoiceHtmlSheet html={previewHtml} zoom={zoom} />
            </View>
          </View>

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
  // The rendered document fills the space above the zoom bar so pinch-zoom
  // has room to work.
  // Height is set at the call site from the window; see sheetHeight.
  sheetFill: { width: '100%' },
  sheetWrap: { paddingTop: 4, paddingBottom: 4 },
  zoomBar: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
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
