import { useEffect, useRef, useState } from 'react';
import { Alert, InteractionManager, View } from 'react-native';
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
  // Uri of the capture currently shown in the Delete/Calculate preview. Read by
  // the deferred early-upload callback so it never (re)starts an upload for a
  // capture that has since been calculated (possibly cropped) or deleted.
  const previewUriRef = useRef<string | null>(null);
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

  // Deliberately excludes isPickingImage: showing the preview card while the
  // system album loads only delays and flickers in front of the picker.
  const overlayVisible = isStartingOperation || Boolean(pendingPreview);

  const instruction =
    captureStep === 'second'
      ? 'Align back side of tag inside frame'
      : 'Align jewellery tag inside frame';

  useEffect(() => {
    if (!isFocused) return;
    const state = useScannerStore.getState();
    if (state.scanId || state.frontImageUri || state.backImageUri) return;
    scanSessionPrewarmRef.current = null;
    previewUriRef.current = null;
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

    setPendingPreview({
      uri,
      step: captureStep,
      source,
    });
    previewUriRef.current = uri;
    // Prewarm the scan session (network only, cheap) right away, but defer the
    // full-res decode/encode until the preview overlay has painted its first
    // frame so it does not jank the card. prepareImageForUpload falls back to
    // on-demand preparation if the prewarm has not registered yet.
    prewarmScanSession();
    InteractionManager.runAfterInteractions(() => {
      prewarmImagePreparation(uri);
      // Start the front upload now, while the user is still looking at the
      // preview, instead of on Calculate. Registered after the preparation
      // prewarm so it reuses that decode. If the user reframes, Calculate hands
      // the pipeline the cropped uri, which ABORTS this upload before starting
      // the cropped one; Delete/reset abort it via invalidateBackgroundUploads.
      if (previewUriRef.current !== uri) {
        return;
      }
      const prewarmedSession = scanSessionPrewarmRef.current;
      if (prewarmedSession && prewarmedSession.jewelleryType === selectedType) {
        startBackgroundSideUpload(prewarmedSession.promise, 'front', uri);
      }
    });
  };

  // The preview exported a crop while the user is still looking at it: start
  // uploading that file now. The registry aborts the original's upload for
  // this side, and processing reuses this one when Calculate hands it the
  // same uri.
  const handlePreviewAdjusted = (croppedUri: string) => {
    if (!pendingPreview) return;
    const prewarmedSession = scanSessionPrewarmRef.current;
    if (prewarmedSession && prewarmedSession.jewelleryType === selectedType) {
      startBackgroundSideUpload(prewarmedSession.promise, 'front', croppedUri);
    }
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
    previewUriRef.current = null;

    if (step === 'first') {
      const frontCapture = { uri, source };
      setConfirmedFront(frontCapture);
      // The front upload was already started when the preview opened. Same
      // uri: the pipeline is idempotent and reuses it. Cropped uri: the
      // pipeline aborts the early (uncropped) upload and starts this one, so
      // the stale image can never overwrite the cropped one on the server.
      const prewarmedSession = scanSessionPrewarmRef.current;
      if (prewarmedSession && prewarmedSession.jewelleryType === selectedType) {
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
    previewUriRef.current = null;
    if (pendingPreview) {
      // Deleted capture: drop its prewarmed preparation; keep the scan session for the next capture.
      invalidatePrewarmedImagePreparation(pendingPreview.uri);
    }
    // Abort (not just forget) the early upload of the deleted capture so it can
    // never land on the server after the next capture's upload.
    invalidateBackgroundUploads();
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
    previewUriRef.current = null;
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
    if (overlayVisible || isPickingImage) return;

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
        cameraPaused={isPickingImage}
        cameraRef={cameraRef}
      >
        <BarcodeOverlay />
      </ScannerScreenLayout>

      <CapturePreviewOverlay
        visible={overlayVisible}
        loading={isStartingOperation}
        uri={pendingPreview?.uri}
        title="Captured Image"
        showAddMore={pendingPreview?.step === 'first'}
        onDelete={handlePreviewDelete}
        onCalculate={handlePreviewCalculate}
        onAdjusted={handlePreviewAdjusted}
        onAddMore={handleAddMoreImage}
      />
    </View>
  );
}
