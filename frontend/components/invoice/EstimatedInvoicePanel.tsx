import { useMemo, useState } from 'react';
import { Alert, Linking, Platform, Share, StyleSheet, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MailComposer from 'expo-mail-composer';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ArrowDownToLine, MessageCircle } from 'lucide-react-native';

import { InvoiceQuickActions, type InvoiceAction } from '@/components/invoice/InvoiceQuickActions';
import { MrpBreakdownCard } from '@/components/scanner/MrpBreakdownCard';
import { PillButton } from '@/components/scanner/ReviewCardKit';
import { Colors } from '@/constants/theme';
import {
  estimateBreakdown,
  estimateHtml,
  estimateText,
  rupees,
} from '@/utils/estimateBreakdown';
import type { InvoiceLineItemRow } from '@/utils/moneyMath';

interface EstimatedInvoicePanelProps {
  /** The lines the GST invoice bills: the estimate is exactly these, grouped. */
  rows: readonly InvoiceLineItemRow[];
  /** What it is of: the piece's name and code, or the cart. */
  title: string;
  shopName?: string;
}

function safeFileName(text: string): string {
  return text.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
}

/**
 * The Estimated Invoice tab, as the design has it: the share row (WhatsApp,
 * Drive, Download, Gmail, Print), the MRP Breakdown, then Share on WhatsApp
 * and Download. Every one of them carries the same figures as the card: the
 * PDF is that card, and the text is its rows.
 */
export function EstimatedInvoicePanel({ rows, title, shopName }: EstimatedInvoicePanelProps) {
  const breakdown = useMemo(() => estimateBreakdown(rows), [rows]);
  const [busy, setBusy] = useState<InvoiceAction | null>(null);
  const text = estimateText(breakdown, title);
  const html = () => estimateHtml(breakdown, { title, shopName });
  const fileName = `MRP-Estimate-${safeFileName(title)}.pdf`;
  const ready = breakdown.total > 0;

  const guard = (): boolean => {
    if (ready) return true;
    Alert.alert('Estimate not ready', 'The price has not loaded yet. Please wait a moment and try again.');
    return false;
  };

  /** The breakdown as a PDF in the app's cache, under a readable name. */
  const makePdf = async (): Promise<string> => {
    const { uri } = await Print.printToFileAsync({ html: html(), width: 595, height: 842 });
    const target = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.deleteAsync(target, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: target });
    return target;
  };

  const run = async (action: InvoiceAction, work: () => Promise<void>) => {
    if (!guard() || busy) return;
    setBusy(action);
    try {
      await work();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (!/cancel/i.test(message)) Alert.alert('Error', message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  // Download: into a folder the shop picks (Android), or Save to Files (iPhone).
  const download = () => run('download', async () => {
    const uri = await makePdf();
    if (Platform.OS === 'ios') {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Save ${fileName}`, UTI: 'com.adobe.pdf' });
      return;
    }
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Not saved', 'No folder was chosen. Tap Download again to pick one.');
      return;
    }
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const target = await FileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri, fileName, 'application/pdf',
    );
    await FileSystem.writeAsStringAsync(target, base64, { encoding: FileSystem.EncodingType.Base64 });
    Alert.alert('Downloaded', `${fileName} has been saved to the folder you chose.`);
  });

  // WhatsApp: the breakdown as text, straight into WhatsApp; without it, the share sheet.
  const whatsapp = () => run('whatsapp', async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(url);
    } catch {
      await Share.share({ message: text });
    }
  });

  const drive = () => run('drive', async () => {
    const uri = await makePdf();
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Save ${fileName} to Google Drive`, UTI: 'com.adobe.pdf' });
  });

  const email = () => run('email', async () => {
    const uri = await makePdf();
    if (await MailComposer.isAvailableAsync()) {
      await MailComposer.composeAsync({ subject: `MRP Estimate — ${title}`, body: text, attachments: [uri] });
    } else {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Email ${fileName}`, UTI: 'com.adobe.pdf' });
    }
  });

  const print = () => run('print', async () => {
    await Print.printAsync({ html: html() });
  });

  const onAction = (action: InvoiceAction) => {
    if (action === 'whatsapp') void whatsapp();
    else if (action === 'drive') void drive();
    else if (action === 'download') void download();
    else if (action === 'email') void email();
    else void print();
  };

  return (
    <View>
      <View style={styles.actions}>
        <InvoiceQuickActions busy={busy} onPress={onAction} />
      </View>

      <MrpBreakdownCard
        goldAmount={rupees(breakdown.gold)}
        diamondAmount={breakdown.diamond > 0 ? rupees(breakdown.diamond) : undefined}
        colorstoneAmount={breakdown.colorstone > 0 ? rupees(breakdown.colorstone) : undefined}
        labourAmount={rupees(breakdown.labour)}
        wastageAmount={breakdown.wastage > 0 ? rupees(breakdown.wastage) : undefined}
        otherChargesTotal={breakdown.otherCharges > 0 ? rupees(breakdown.otherCharges) : undefined}
        ultimateMrp={rupees(breakdown.total)}
      />

      <View style={styles.buttons}>
        <PillButton
          variant="alt"
          title="Share on WhatsApp"
          onPress={() => void whatsapp()}
          disabled={busy !== null}
          icon={<MessageCircle size={16} color={Colors.brandDeep} />}
          style={styles.button}
        />
        <PillButton
          variant="brand"
          title={busy === 'download' ? 'Downloading…' : 'Download'}
          onPress={() => void download()}
          disabled={busy !== null}
          icon={busy === 'download' ? undefined : <ArrowDownToLine size={16} color={Colors.white} />}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { alignItems: 'flex-end', marginBottom: 10 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  button: { flex: 1 },
});
