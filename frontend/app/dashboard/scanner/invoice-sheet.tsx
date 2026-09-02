import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import { Minus, Plus, Search } from 'lucide-react-native';

import { InvoiceHtmlSheet } from '@/components/invoice/InvoiceHtmlSheet';
import { InvoiceQuickActions, type InvoiceAction } from '@/components/invoice/InvoiceQuickActions';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav, BOTTOM_NAV_HEIGHT, getBottomNavBottom } from '@/components/dashboard/BottomNav';
import { ScreenBackHeader } from '@/components/scanner/ScreenBackHeader';
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
 * Preview — the tax invoice rendered natively before anything is
 * generated.
 *
 * The header quick actions all generate the PDF once (the moment an invoice
 * number is consumed): Download writes it into a folder the user chooses via
 * SAF; WhatsApp sends the durable invoice link instead; Drive, Email and
 * Print hand the fetched PDF to the share sheet, mail composer and print
 * dialog respectively.
 */
export default function InvoiceSheetScreen() {
  const [zoomIndex, setZoomIndex] = useState(1);
  // Controls clear the floating nav using its own geometry, not a guess.
  const insets = useSafeAreaInsets();
  const controlsBottom = getBottomNavBottom(insets.bottom) + BOTTOM_NAV_HEIGHT + 12;
  const [invoiceNumber, setInvoiceNumber] = useState('—');
  const [working, setWorking] = useState<InvoiceAction | null>(null);
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

  /** Generates once, then fetches the PDF into app cache. Returns a file:// uri. */
  // One download per invoice: WhatsApp, then Drive, then Email all reuse it.
  const [pdfCache] = useState<{ current: { result: Awaited<ReturnType<typeof generateOnce>>; fileName: string; uri: string } | null }>(
    { current: null },
  );

  const fetchPdfToCache = async () => {
    const result = await generateOnce();
    if (pdfCache.current && pdfCache.current.result.invoiceNumber === result.invoiceNumber) {
      const info = await FileSystem.getInfoAsync(pdfCache.current.uri);
      if (info.exists) return pdfCache.current;
    }
    const fileName = `Invoice-${String(result.invoiceNumber).replace(/[^\w.-]+/g, '-')}.pdf`;
    const cached = `${FileSystem.cacheDirectory ?? ''}${fileName}`;
    // The renderer answers 409/425 until the PDF is ready; poll instead of failing.
    let downloaded = await FileSystem.downloadAsync(resolveInvoicePdfUrl(result), cached);
    for (let attempt = 0; attempt < 30 && (downloaded.status === 409 || downloaded.status === 425); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      downloaded = await FileSystem.downloadAsync(resolveInvoicePdfUrl(result), cached);
    }
    if (downloaded.status !== 200) {
      throw new Error(`Could not fetch the invoice (HTTP ${downloaded.status}).`);
    }
    const entry = { result, fileName, uri: downloaded.uri };
    pdfCache.current = entry;
    return entry;
  };

  /**
   * Generates the invoice and writes the PDF into a folder the user picks, so
   * it lands in their own storage rather than reopening the document on screen.
   */
  const handleDownload = async () => {
    if (!guardTotals() || working) return;
    setWorking('download');
    try {
      // Fetch into app storage first: a failed download must not leave an
      // empty file sitting in the user's folder.
      const { fileName, uri } = await fetchPdfToCache();

      const permission =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Saved in the app',
          `${fileName} was downloaded but not copied out, because no folder was chosen. Tap Download again to pick one.`,
        );
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
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

  // WHATSAPP — the PDF itself, never a link. The document is fetched into the
  // cache and handed to the system share sheet, where WhatsApp is one tap
  // away; the recipient gets the file, not a URL to open. That means waiting
  // for generation before the sheet appears, which is what the spinner is for.
  const handleShare = async () => {
    if (!guardTotals() || working) return;
    setWorking('whatsapp');
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }
      const { uri, fileName } = await fetchPdfToCache();
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Send ${fileName}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not share the invoice.',
      );
    } finally {
      setWorking(null);
    }
  };

  // Accompanying text for the email body. No link: the PDF travels as the
  // attachment, so there is nothing for the recipient to open elsewhere.
  const shareText = (number: string) =>
    `Invoice ${number} from ${profile.businessName || 'us'} — ` +
    `₹ ${Math.round(grandTotal).toLocaleString('en-IN')}. The invoice is attached as a PDF.`;

  // DRIVE — system share sheet; the user taps "Drive"/"Save to Drive". expo-sharing
  // hands Android a FileProvider content:// URI with a Parcelable EXTRA_STREAM, which
  // is what Drive's upload activity requires.
  const handleDrive = async () => {
    if (!guardTotals() || working) return;
    setWorking('drive');
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }
      const { uri, fileName } = await fetchPdfToCache();
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Save ${fileName} to Google Drive`,
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not open the share sheet.');
    } finally {
      setWorking(null);
    }
  };

  // EMAIL — native mail composer with the PDF attached. Without a composer the
  // file goes through the share sheet instead of a mailto: link, since a
  // mailto: cannot carry an attachment and a bare link is not the invoice.
  const handleEmail = async () => {
    if (!guardTotals() || working) return;
    setWorking('email');
    try {
      const { result, uri, fileName } = await fetchPdfToCache();
      const subject = `Invoice ${result.invoiceNumber} from ${profile.businessName || 'us'}`;
      const body = shareText(result.invoiceNumber);
      const recipients = customer.customerEmail.trim() ? [customer.customerEmail.trim()] : [];
      if (await MailComposer.isAvailableAsync()) {
        await MailComposer.composeAsync({ recipients, subject, body, attachments: [uri] });
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Email ${fileName}`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not open email.');
    } finally {
      setWorking(null);
    }
  };

  // PRINT — Android system print dialog fed the local PDF (most reliable; remote
  // URLs and HTML re-layout are avoided so the printout is the PDFMonkey document).
  const handlePrint = async () => {
    if (!guardTotals() || working) return;
    setWorking('print');
    try {
      const { uri } = await fetchPdfToCache();
      await Print.printAsync({ uri });
    } catch (err) {
      // User-cancelled print dialogs reject on some devices; do not alert for those.
      const message = err instanceof Error ? err.message : '';
      if (!/cancel/i.test(message)) Alert.alert('Error', message || 'Could not print the invoice.');
    } finally {
      setWorking(null);
    }
  };

  const handleAction = (action: InvoiceAction) => {
    if (action === 'whatsapp') void handleShare();
    else if (action === 'drive') void handleDrive();
    else if (action === 'download') void handleDownload();
    else if (action === 'email') void handleEmail();
    else void handlePrint();
  };

  const zoom = ZOOM_STEPS[zoomIndex];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenBackHeader
        title="Preview"
        right={<InvoiceQuickActions busy={working} onPress={handleAction} />}
      />

      {/* The document fills every pixel between the header and the controls. */}
      <View style={styles.viewer}>
        {!ratesLoaded && grandTotal <= 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Preparing preview…</Text>
          </View>
        ) : (
          <InvoiceHtmlSheet html={previewHtml} zoom={zoom} />
        )}
      </View>

      {/* Controls sit outside the document, so panning or pinching the invoice
          never moves them. */}
      <View style={[styles.controls, { paddingBottom: controlsBottom }]}>
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
      </View>

      <BottomNav activeRoute="scanner" scanButtonVariant="green" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  // Takes all remaining height, so the invoice is shown full screen.
  viewer: { flex: 1, marginHorizontal: 12, borderRadius: 10, overflow: 'hidden' },
  controls: { paddingHorizontal: 16, paddingTop: 8 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: Colors.textSecondary },
  // The rendered document fills the space above the zoom bar so pinch-zoom
  // has room to work.
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
});
