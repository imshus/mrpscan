import { useState } from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Download, ExternalLink, Home } from 'lucide-react-native';

import { PrimaryGreenButton } from '@/components/scanner/PrimaryGreenButton';
import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';

export default function PrintInvoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    pdfUrl?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
  }>();

  const [opening, setOpening] = useState(false);

  const pdfUrl = params.pdfUrl ?? '';
  const invoiceNumber = params.invoiceNumber ?? '—';
  const invoiceDate = params.invoiceDate ?? '—';

  const handleOpenPdf = async () => {
    if (!pdfUrl) {
      Alert.alert('Error', 'PDF URL not available.');
      return;
    }
    setOpening(true);
    try {
      const supported = await Linking.canOpenURL(pdfUrl);
      if (supported) {
        await Linking.openURL(pdfUrl);
      } else {
        Alert.alert('Cannot Open', 'Unable to open the PDF on this device. Try copying the URL manually.');
      }
    } catch {
      Alert.alert('Error', 'Failed to open the PDF. Please try again.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <ScanScreenWrapper
      title="Invoice Generated"
      className="bg-surface-muted"
      scanButtonVariant="green"
      footer={
        <View className="gap-3">
          <PrimaryGreenButton
            title={opening ? 'Opening...' : 'Open PDF'}
            onPress={handleOpenPdf}
            icon={<ExternalLink size={18} color="#FFFFFF" />}
          />
          <TouchableOpacity
            onPress={() => router.replace('/dashboard')}
            className="flex-row items-center justify-center gap-2 rounded-button border border-border bg-white py-3"
          >
            <Home size={18} color="#A81F17" />
            <Text className="text-sm font-semibold text-text-primary">Back to Home</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <BackgroundPattern />

      {/* Success Card */}
      <View className="mb-4 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        {/* Header */}
        <View className="items-center bg-primary px-6 pb-6 pt-8">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-white/15">
            <CheckCircle2 size={44} color="#FFFFFF" />
          </View>
          <Text className="text-2xl font-bold text-white">Invoice Ready!</Text>
          <Text className="mt-1 text-center text-sm text-white/70">
            Your PDF has been generated successfully
          </Text>
        </View>

        <View className="h-1 bg-accent-gold" />

        {/* Invoice Details */}
        <View className="gap-4 p-5">
          <View className="rounded-xl border border-border bg-surface-muted p-4">
            <View className="mb-3 border-b border-border pb-3">
              <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-label">
                Invoice Number
              </Text>
              <Text className="text-base font-bold text-text-primary">{invoiceNumber}</Text>
            </View>
            <View>
              <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-label">
                Generated On
              </Text>
              <Text className="text-sm text-text-primary">{invoiceDate}</Text>
            </View>
          </View>

          {/* PDF URL pill */}
          {pdfUrl ? (
            <View className="rounded-xl border border-green-200 bg-green-50 p-4">
              <View className="mb-2 flex-row items-center gap-2">
                <Download size={16} color="#16A34A" />
                <Text className="text-[10px] font-bold uppercase tracking-wide text-success-text">
                  PDF Download Link
                </Text>
              </View>
              <Text
                className="text-xs leading-5 text-text-secondary"
                numberOfLines={3}
                ellipsizeMode="middle"
              >
                {pdfUrl}
              </Text>
            </View>
          ) : (
            <View className="rounded-xl border border-red-200 bg-red-50 p-4">
              <Text className="text-sm text-red-600">
                PDF URL not available. Please try generating again.
              </Text>
            </View>
          )}

          <Text className="text-center text-xs leading-5 text-text-muted">
            The PDF link is hosted by PDFMonkey and will be available for a limited time.
            Tap "Open PDF" to view or download your invoice.
          </Text>
        </View>
      </View>
    </ScanScreenWrapper>
  );
}
