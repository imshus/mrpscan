import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { BarcodeOverlay } from '@/components/scanner/BarcodeOverlay';
import { type CaptureSource } from '@/components/scanner/CapturedSidesStrip';
import { CapturePreviewOverlay } from '@/components/scanner/CapturePreviewOverlay';
import { ScannerScreenLayout } from '@/components/scanner/ScannerScreenLayout';
import type { TagCameraPreviewRef } from '@/components/scanner/TagCameraPreview';
import { useScannerStore } from '@/store/scannerStore';
import type { CreateScanResponse, JewelleryType } from '@/types/scanner';
import { ApiError } from '@/utils/apiClient';
import {
  captureScanImageFallback,
  invalidatePrewarmedImagePreparation,
  pickImageFromGallery,
  prewarmImagePreparation,
} from '@/utils/imagePicker';
import { createScan } from '@/utils/scanApi';
import { invalidateBackgroundUploads, startBackgroundSideUpload } from '@/utils/uploadPipeline';

type PendingPreview = {
  uri: string;
  step: 'first' | 'second';
  source: CaptureSource;
};

type ConfirmedCapture = {
  uri: string;
  source: CaptureSource;
};

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const cameraRef = useRef<TagCameraPreviewRef>(null);
  const operationStartingRef = useRef(false);
  const scanSessionPrewarmRef = useRef<{
    jewelleryType: JewelleryType;
    promise: Promise<CreateScanResponse>;
  } | null>(null);
  const selectedType = useScannerStore((s) => s.selectedType);
  const setScanId = useScannerStore((s) => s.setScanId);
  const setFrontImageUri = useScannerStore((s) => s.setFrontImageUri);
  const setBackImageUri = useScannerStore((s) => s.setBackImageUri);
  const resetScanLoading = useScannerStore((s) => s.resetScanLoading);
  const resetScanSession = useScannerStore((s) => s.resetScanSession);
  const setScanSessionBootstrapping = useScannerStore((s) => s.setScanSessionBootstrapping);

  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isStartingOperation, setIsStartingOperation] = useState(false);
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null);
  const [confirmedFront, setConfirmedFront] = useState<ConfirmedCapture | null>(null);
  const [confirmedBack, setConfirmedBack] = useState<ConfirmedCapture | null>(null);
  const [captureStep, setCaptureStep] = useState<'first' | 'second'>('first');

  const overlayVisible = isPickingImage || isStartingOperation || Boolean(pendingPreview);

  const instruction =
    captureStep === 'second'
      ? 'Align back side of tag inside frame'
      : 'Align jewellery tag inside frame';

  useEffect(() => {
    if (!isFocused) return;
    const state = useScannerStore.getState();
    if (state.scanId || state.frontImageUri || state.backImageUri) return;
    scanSessionPrewarmRef.current = null;
    invalidateBackgroundUploads();
    setPendingPreview(null);
    setConfirmedFront(null);
    setConfirmedBack(null);
    setCaptureStep('first');
    setIsPickingImage(false);
    setIsStartingOperation(false);
  }, [isFocused]);

  const prewarmScanSession = () => {
    const existing = scanSessionPrewarmRef.current;
    if (existing && existing.jewelleryType === selectedType) {
      return;
    }
    const promise = createScan(selectedType, 'both');
    scanSessionPrewarmRef.current = { jewelleryType: selectedType, promise };
    // Swallow prewarm failures; startScanOperation retries on demand.
    promise.catch(() => {
      if (scanSessionPrewarmRef.current?.promise === promise) {
        scanSessionPrewarmRef.current = null;
      }
    });
  };

  const startScanOperation = async (frontUri: string, backUri: string | null, source: CaptureSource) => {
    if (operationStartingRef.current) return;

    console.info('[CALCULATE_PRESSED]', {
      timestamp: Date.now(),
      source,
      hasBackImage: Boolean(backUri),
    });

    operationStartingRef.current = true;
    setIsStartingOperation(true);
    setScanSessionBootstrapping(true);
    try {
      resetScanSession();
      resetScanLoading();
      const prewarmedSession = scanSessionPrewarmRef.current;
      scanSessionPrewarmRef.current = null;
      let session: CreateScanResponse;
      if (prewarmedSession && prewarmedSession.jewelleryType === selectedType) {
        try {
          session = await prewarmedSession.promise;
        } catch {
          // Prewarm failed; fall back to creating the session on demand.
          session = await createScan(selectedType, 'both');
        }
      } else {
        session = await createScan(selectedType, 'both');
      }
      console.info('[SCAN_ID_READY]', {
        scanId: session.scanId,
        timestamp: Date.now(),
      });
      console.info('[SCAN_OPERATION_START]', {
        scanId: session.scanId,
        jewelleryType: selectedType,
        source,
        hasBackImage: Boolean(backUri),
      });
      setScanId(session.scanId);
      setFrontImageUri(frontUri);
      setBackImageUri(backUri);
      router.replace('/dashboard/scanner/processing' as Href);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Failed to start scan upload. Please try again.';
      Alert.alert('Scan Error', message);
    } finally {
      operationStartingRef.current = false;
      setScanSessionBootstrapping(false);
      setIsStartingOperation(false);
    }
  };

  const openPreview = (uri: string, source: CaptureSource) => {
    // If we're on the second capture step, immediately accept and start
    // processing instead of showing the preview overlay with Delete/Calculate.
    if (captureStep === 'second') {
      const backCapture = { uri, source };
      setConfirmedBack(backCapture);
      // Start uploading the back image immediately so it overlaps session
      // await + navigation; processing reuses it (or re-uploads on failure).
      const prewarmedSession = scanSessionPrewarmRef.current;
      if (prewarmedSession && prewarmedSession.jewelleryType === selectedType) {
        startBackgroundSideUpload(prewarmedSession.promise, 'back', uri);
      }
      void startScanOperation(confirmedFront?.uri ?? uri, uri, source);
      return;
    }

    // Prewarm upload preparation and the scan session while the user reviews the capture.
    prewarmImagePreparation(uri);
    prewarmScanSession();

    setPendingPreview({
      uri,
      step: captureStep,
      source,
    });
  };

  const handlePreviewCalculate = (adjustedUri?: string) => {
    if (!pendingPreview) return;

    const { step, source } = pendingPreview;
    // A reframed capture produces a new cropped file, so the preparation that
    // was prewarmed for the original image no longer applies.
    const uri = adjustedUri ?? pendingPreview.uri;
    if (adjustedUri) {
      invalidatePrewarmedImagePreparation(pendingPreview.uri);
    }
    setPendingPreview(null);

    if (step === 'first') {
      const frontCapture = { uri, source };
      setConfirmedFront(frontCapture);
      // The image preparation is already prewarmed at preview open, so this
      // upload starts immediately and overlaps navigation/mount. Kept here
      // (not openPreview) because the user can still Delete from the preview.
      const prewarmedSession = scanSessionPrewarmRef.current;
      if (!adjustedUri && prewarmedSession && prewarmedSession.jewelleryType === selectedType) {
        startBackgroundSideUpload(prewarmedSession.promise, 'front', uri);
      }
      void startScanOperation(uri, null, source);
      return;
    }

    const backCapture = { uri, source };
    setConfirmedBack(backCapture);
    void startScanOperation(confirmedFront?.uri ?? uri, uri, source);
  };

  const handlePreviewDelete = () => {
    if (pendingPreview) {
      // Deleted capture: drop its prewarmed preparation; keep the scan session for the next capture.
      invalidatePrewarmedImagePreparation(pendingPreview.uri);
    }
    if (pendingPreview?.step === 'second') {
      setConfirmedBack(null);
      setBackImageUri(null);
    }
    setPendingPreview(null);
    setIsPickingImage(false);
  };

  const handleAddMoreImage = () => {
    if (!pendingPreview) return;

    const { uri, source } = pendingPreview;
    const frontCapture = { uri, source };
    setConfirmedFront(frontCapture);
    setPendingPreview(null);
    setCaptureStep('second');

    // Upload the confirmed front image in the background while the user shoots
    // the back side. Keyed by scanId+uri so a different image can never be
    // reused; failures fall back to processing's on-demand upload.
    prewarmScanSession();
    const prewarmedSession = scanSessionPrewarmRef.current;
    if (prewarmedSession) {
      startBackgroundSideUpload(prewarmedSession.promise, 'front', uri);
    }
  };

  const resolveCaptureUri = async (): Promise<string | null> => {
    const liveUri = await cameraRef.current?.takePicture();
    if (liveUri) {
      return liveUri;
    }

    return captureScanImageFallback();
  };

  const handleShutter = async () => {
    if (overlayVisible) return;

    const uri = await resolveCaptureUri();
    if (!uri) {
      Alert.alert(
        'Image Required',
        'Please capture a clear photo of the jewellery tag, or upload one from your device.',
      );
      return;
    }

    openPreview(uri, 'camera');
  };

  const handleUpload = async () => {
    if (overlayVisible) return;

    setIsPickingImage(true);
    try {
      const uri = await pickImageFromGallery();
      if (!uri) {
        setIsPickingImage(false);
        return;
      }

      setIsPickingImage(false);
      openPreview(uri, 'gallery');
    } catch {
      setIsPickingImage(false);
      Alert.alert('Upload Error', 'Could not load image from your device. Please try again.');
    }
  };

  return (
    <View className="flex-1">
      <ScannerScreenLayout
        instruction={instruction}
        onShutterPress={handleShutter}
        onUploadPress={handleUpload}
        controlsHidden={overlayVisible}
        cameraRef={cameraRef}
      >
        <BarcodeOverlay />
      </ScannerScreenLayout>

      <CapturePreviewOverlay
        visible={overlayVisible}
        loading={isPickingImage || isStartingOperation}
        uri={pendingPreview?.uri}
        title="Captured Image"
        showAddMore={pendingPreview?.step === 'first'}
        onDelete={handlePreviewDelete}
        onCalculate={handlePreviewCalculate}
        onAddMore={handleAddMoreImage}
      />
    </View>
  );
}
