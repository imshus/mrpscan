import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ExternalLink, Home } from 'lucide-react-native';
import Pdf from 'react-native-pdf';
import * as FileSystem from 'expo-file-system/legacy';

import { ScanScreenWrapper } from '@/components/scanner/ScanScreenWrapper';

// A ScrollView parent gives children no intrinsic height, so the PDF is sized
// against the viewport instead of flexing.
const VIEWER_HEIGHT = Math.round(Dimensions.get('window').height * 0.68);

export default function PrintInvoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    pdfUrl?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);

  const pdfUrl = params.pdfUrl ?? '';
  const invoiceNumber = params.invoiceNumber ?? '—';

  // PDFMonkey serves a signed link that redirects to storage. react-native-pdf
  // fetches it with its own downloader, which gives up on that redirect
  // ("Download interrupted."), so the file is fetched here first and the
  // viewer is pointed at the local copy.
  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;

    (async () => {
      try {
        const target = `${FileSystem.cacheDirectory ?? ''}invoice-${Date.now()}.pdf`;
        const result = await FileSystem.downloadAsync(pdfUrl, target);
        if (cancelled) return;
        if (result.status !== 200) {
          setError(`The invoice could not be downloaded (HTTP ${result.status}).`);
          setLoading(false);
          return;
        }
        setLocalUri(result.uri);
      } catch (downloadError) {
        if (cancelled) return;
        setError(
          downloadError instanceof Error
            ? downloadError.message
            : 'The invoice could not be downloaded.',
        );
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  const handleOpenExternally = async () => {
    if (!pdfUrl) return;
    try {
      await Linking.openURL(pdfUrl);
    } catch {
      Alert.alert('Error', 'Failed to open the PDF. Please try again.');
    }
  };

  return (
    <ScanScreenWrapper
      title={`Invoice ${invoiceNumber}`}
      className="bg-surface-muted"
      scanButtonVariant="green"
    >
      {/* Actions sit above the document so they stay reachable while the PDF
          is zoomed and panned. */}
      <View className="mb-3 flex-row gap-3">
        <TouchableOpacity
          onPress={handleOpenExternally}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-button border border-border bg-white py-3"
        >
          <ExternalLink size={18} color="#A81F17" />
          <Text className="text-sm font-semibold text-text-primary">Open externally</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace('/dashboard')}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-button border border-border bg-white py-3"
        >
          <Home size={18} color="#A81F17" />
          <Text className="text-sm font-semibold text-text-primary">Home</Text>
        </TouchableOpacity>
      </View>

      <View
        style={{ height: VIEWER_HEIGHT }}
        className="overflow-hidden rounded-2xl border border-border bg-white"
      >
        {!pdfUrl ? (
          <View className="flex-1 items-center justify-center p-6">
            <Text className="text-center text-sm text-red-600">
              PDF is not available. Please generate the invoice again.
            </Text>
          </View>
        ) : (
          <>
            {/*
              Rendered natively rather than in a WebView: PDFMonkey hands back a
              signed, time-limited S3 link, which Android's WebView cannot show
              and Google's document viewer silently renders as a blank page.
            */}
            {localUri ? (
              <Pdf
                source={{ uri: localUri }}
                trustAllCerts={false}
                style={{ flex: 1, width: '100%', backgroundColor: '#FFFFFF' }}
                fitPolicy={0}
                minScale={1}
                maxScale={5}
                scale={1}
                enablePaging={false}
                enableDoubleTapZoom
                enableAntialiasing
                onLoadComplete={() => setLoading(false)}
                onError={(err) => {
                  setLoading(false);
                  setError(err instanceof Error ? err.message : 'The invoice could not be displayed.');
                }}
              />
            ) : null}
            {loading && !error ? (
              <View className="absolute inset-0 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#A81F17" />
                <Text className="mt-3 text-xs text-text-secondary">Loading invoice…</Text>
              </View>
            ) : null}
            {error ? (
              <View className="absolute inset-0 items-center justify-center gap-3 bg-white p-6">
                <Text className="text-center text-sm text-text-secondary">{error}</Text>
                <TouchableOpacity
                  onPress={handleOpenExternally}
                  className="flex-row items-center gap-2 rounded-button bg-primary px-5 py-3"
                >
                  <ExternalLink size={16} color="#FFFFFF" />
                  <Text className="text-sm font-semibold text-white">Open the PDF</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}
      </View>
    </ScanScreenWrapper>
  );
}
