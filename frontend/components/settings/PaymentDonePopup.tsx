import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, FileText, Mail } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PopupCloseButton } from '@/components/ui/PopupCloseButton';
import { Colors, Radius } from '@/constants/theme';
import { emailPaymentInvoice, fetchPaymentInvoice, type PaymentInvoice } from '@/utils/subscriptionApi';
import { friendlyServerMessage } from '@/utils/serverMessages';

/** A payment that has just gone through, for the popup to announce. */
export interface PaidOrder {
  orderId: string;
  /** "Credits Added", "Licence Activated". */
  title: string;
  message: string;
  /** The billing email from the popup before paying: where Email Invoice sends. */
  email: string;
}

interface PaymentDonePopupProps {
  /** Null keeps the popup closed. */
  paid: PaidOrder | null;
  onClose: () => void;
}

type EmailState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; to: string } | { kind: 'error'; message: string };

/**
 * Says the payment went through and emails MRPscan's invoice for it on its
 * own, to the billing email given before paying, saying where it went (or
 * why it could not). View Invoice opens it full screen; Email Invoice sends
 * it again. Styled as the app's other popups; the cross closes it.
 */
export function PaymentDonePopup({ paid, onClose }: PaymentDonePopupProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const [emailState, setEmailState] = useState<EmailState>({ kind: 'idle' });
  const [invoice, setInvoice] = useState<PaymentInvoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  // The automatic email: sent as the popup opens, once per payment. A popup
  // closed or replaced meanwhile ignores the answer.
  const autoSendFor = useRef<string | null>(null);
  useEffect(() => {
    if (!paid) {
      autoSendFor.current = null;
      return;
    }
    const orderId = paid.orderId;
    autoSendFor.current = orderId;
    setEmailState({ kind: 'sending' });
    emailPaymentInvoice(orderId, undefined, { auto: true })
      .then((to) => {
        if (autoSendFor.current === orderId) setEmailState({ kind: 'sent', to: to || paid.email });
      })
      .catch((error) => {
        if (autoSendFor.current === orderId) {
          setEmailState({ kind: 'error', message: friendlyServerMessage(error, 'Could not email the invoice.') });
        }
      });
  }, [paid]);

  useEffect(() => {
    if (!paid) return;
    setInvoice(null);
    setInvoiceError(null);
    setViewerOpen(false);
    opacity.setValue(0);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [paid, opacity, scale]);

  if (!paid) return null;

  const sendEmail = async () => {
    if (emailState.kind === 'sending') return;
    setEmailState({ kind: 'sending' });
    try {
      const to = await emailPaymentInvoice(paid.orderId, paid.email || undefined);
      setEmailState({ kind: 'sent', to: to || paid.email });
    } catch (error) {
      setEmailState({ kind: 'error', message: friendlyServerMessage(error, 'Could not email the invoice.') });
    }
  };

  const openInvoice = async () => {
    setInvoiceError(null);
    if (invoice) {
      setViewerOpen(true);
      return;
    }
    setLoadingInvoice(true);
    try {
      const loaded = await fetchPaymentInvoice(paid.orderId);
      setInvoice(loaded);
      setViewerOpen(true);
    } catch (error) {
      setInvoiceError(friendlyServerMessage(error, 'Could not load the invoice.'));
    } finally {
      setLoadingInvoice(false);
    }
  };

  const emailLine =
    emailState.kind === 'sent'
      ? { text: `Tax Invoice emailed to ${emailState.to}.`, error: false, ok: true }
      : emailState.kind === 'sending'
        ? { text: `Emailing the invoice${paid.email ? ` to ${paid.email}` : ''}…`, error: false, ok: false }
        : emailState.kind === 'error'
          ? { text: emailState.message, error: true, ok: false }
          : invoiceError
            ? { text: invoiceError, error: true, ok: false }
            : null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <PopupCloseButton onPress={onClose} style={styles.close} />
          <View style={styles.iconWrap}>
            <CheckCircle2 size={22} color={Colors.successText} strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>{paid.title}</Text>
          <Text style={styles.message}>{paid.message}</Text>

          <Pressable
            onPress={openInvoice}
            disabled={loadingInvoice}
            style={styles.primary}
            accessibilityRole="button"
          >
            {loadingInvoice ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <FileText size={16} color={Colors.white} strokeWidth={2.4} />
                <Text style={styles.primaryLabel}>View Invoice</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={sendEmail}
            disabled={emailState.kind === 'sending'}
            style={styles.secondary}
            accessibilityRole="button"
          >
            {emailState.kind === 'sending' ? (
              <ActivityIndicator color={Colors.brandDeep} />
            ) : (
              <>
                <Mail size={16} color={Colors.brandDeep} strokeWidth={2.4} />
                <Text style={styles.secondaryLabel}>
                  {emailState.kind === 'sent' ? 'Email Again' : 'Email Invoice'}
                </Text>
              </>
            )}
          </Pressable>
          {emailLine ? (
            <Text
              style={[styles.status, emailLine.ok && styles.statusOk, emailLine.error && styles.statusError]}
              accessibilityLiveRegion="polite"
            >
              {emailLine.text}
            </Text>
          ) : null}
        </Animated.View>
      </View>

      <Modal visible={viewerOpen && Boolean(invoice)} animationType="slide" onRequestClose={() => setViewerOpen(false)}>
        <SafeAreaView style={styles.viewer} edges={['top', 'bottom']}>
          <View style={styles.viewerHeader}>
            <Text style={styles.viewerTitle} numberOfLines={1}>
              {invoice?.title ?? 'Invoice'}
              {invoice?.invoiceNumber ? ` · ${invoice.invoiceNumber}` : ''}
            </Text>
            <PopupCloseButton onPress={() => setViewerOpen(false)} />
          </View>
          {invoice?.html ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: invoice.html }}
              style={styles.webview}
              javaScriptEnabled={false}
              setSupportMultipleWindows={false}
            />
          ) : null}
          <View style={styles.viewerFooter}>
            <Pressable
              onPress={sendEmail}
              disabled={emailState.kind === 'sending'}
              style={styles.primary}
              accessibilityRole="button"
            >
              {emailState.kind === 'sending' ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Mail size={16} color={Colors.white} strokeWidth={2.4} />
                  <Text style={styles.primaryLabel}>
                    {emailState.kind === 'sent' ? 'Email Again' : 'Email Invoice'}
                  </Text>
                </>
              )}
            </Pressable>
            {emailLine ? (
              <Text style={[styles.status, emailLine.ok && styles.statusOk, emailLine.error && styles.statusError]}>
                {emailLine.text}
              </Text>
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 18, 13, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    paddingHorizontal: 24,
    paddingVertical: 26,
    shadowColor: '#15120D',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  close: { position: 'absolute', top: 8, right: 8 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.successBg,
  },
  title: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  message: {
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  primary: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: Colors.brandDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { fontSize: 14, fontWeight: '800', color: Colors.white },
  secondary: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 11,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.brandDeep,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { fontSize: 14, fontWeight: '800', color: Colors.brandDeep },
  status: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  statusOk: { color: Colors.successText, fontWeight: '700' },
  statusError: { color: Colors.brandDeep },
  viewer: { flex: 1, backgroundColor: Colors.background },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  viewerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  webview: { flex: 1, backgroundColor: Colors.background },
  viewerFooter: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
});
