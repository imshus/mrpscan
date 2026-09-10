import { useEffect, useRef, useState } from 'react';
import { Alert, InteractionManager, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { BarcodeOverlay } from '@/components/scanner/BarcodeOverlay';
import { type CaptureSource } from '@/components/scanner/CapturedSidesStrip';
import { ScannerScreenLayout } from '@/components/scanner/ScannerScreenLayout';
import type { TagCameraPreviewRef } from '@/components/scanner/TagCameraPreview';
import { useScannerStore } from '@/store/scannerStore';
import type { CreateScanResponse, JewelleryType } from '@/types/scanner';
import { ApiError } from '@/utils/apiClient';
import {
  captureScanImageFallback,
  pickImageFromGallery,
  prewarmImagePreparation,
} from '@/utils/imagePicker';
import { createScan } from '@/utils/scanApi';
import { invalidateBackgroundUploads, startBackgroundSideUpload } from '@/utils/uploadPipeline';

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
  const [confirmedFront, setConfirmedFront] = useState<ConfirmedCapture | null>(null);
  const [confirmedBack, setConfirmedBack] = useState<ConfirmedCapture | null>(null);
  const [captureStep, setCaptureStep] = useState<'first' | 'second'>('first');

  // Deliberately excludes isPickingImage: the controls must not flicker while
  // the system album is coming up.
  const busy = isStartingOperation;

  const onSecondSide = captureStep === 'second';
  const backCaptured = Boolean(confirmedBack);

  const instruction = !onSecondSide
    ? 'Align jewellery tag inside frame'
    : backCaptured
      ? 'Back side captured — tap Calculate to continue'
      : 'Align back side of tag inside frame';

  useEffect(() => {
    if (!isFocused) return;
    const state = useScannerStore.getState();
    if (state.scanId || state.frontImageUri || state.backImageUri) return;
    scanSessionPrewarmRef.current = null;
    invalidateBackgroundUploads();
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

  /**
   * The front side is held and the screen moves straight on to the back — no
   * card in between. Its upload starts here, while the user lines up the
   * second side, so Calculate has less left to wait for.
   */
  const confirmFrontCapture = (uri: string, source: CaptureSource) => {
    setConfirmedFront({ uri, source });
    setConfirmedBack(null);
    setCaptureStep('second');
    prewarmScanSession();
    InteractionManager.runAfterInteractions(() => {
      prewarmImagePreparation(uri);
      const prewarmedSession = scanSessionPrewarmRef.current;
      if (prewarmedSession && prewarmedSession.jewelleryType === selectedType) {
        startBackgroundSideUpload(prewarmedSession.promise, 'front', uri);
      }
    });
  };

  const resolveCaptureUri = async (): Promise<string | null> => {
    const liveUri = await cameraRef.current?.takePicture();
    if (liveUri) {
      return liveUri;
    }

    return captureScanImageFallback();
  };

  /**
   * The back side is kept on the capture screen itself — the frame stays up,
   * the wording changes, and Calculate is right there. Its upload starts now,
   * while the user decides, the same way the front's does.
   */
  const confirmBackCapture = (uri: string, source: CaptureSource) => {
    setConfirmedBack({ uri, source });
    prewarmScanSession();
    InteractionManager.runAfterInteractions(() => {
      prewarmImagePreparation(uri);
      const prewarmedSession = scanSessionPrewarmRef.current;
      if (prewarmedSession && prewarmedSession.jewelleryType === selectedType) {
        startBackgroundSideUpload(prewarmedSession.promise, 'back', uri);
      }
    });
  };

  const handleShutter = async () => {
    if (busy) return;

    const uri = await resolveCaptureUri();
    if (!uri) {
      Alert.alert(
        'Image Required',
        'Please capture a clear photo of the jewellery tag, or upload one from your device.',
      );
      return;
    }

    if (captureStep === 'second') {
      confirmBackCapture(uri, 'camera');
      return;
    }

    confirmFrontCapture(uri, 'camera');
  };

  /** The bin beside the frame: drop both sides and start the scan over. */
  const handleDiscardScan = () => {
    invalidateBackgroundUploads();
    setConfirmedBack(null);
    setConfirmedFront(null);
    setFrontImageUri(null);
    setBackImageUri(null);
    setCaptureStep('first');
  };

  /** Calculate from the capture screen: with the back side when it was taken. */
  const handleCalculateFromCapture = () => {
    if (busy) return;
    const front = confirmedFront;
    if (!front) return;
    void startScanOperation(
      front.uri,
      confirmedBack?.uri ?? null,
      confirmedBack?.source ?? front.source,
    );
  };

  const handleUpload = async () => {
    if (busy || isPickingImage) return;

    setIsPickingImage(true);
    try {
      const uri = await pickImageFromGallery();
      if (!uri) {
        setIsPickingImage(false);
        return;
      }

      setIsPickingImage(false);
      if (captureStep === 'second') confirmBackCapture(uri, 'gallery');
      else confirmFrontCapture(uri, 'gallery');
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
        shutterLabel={onSecondSide ? 'Click for 2nd side' : 'Click'}
        shutterTone={onSecondSide ? 'secondary' : 'primary'}
        onUploadPress={onSecondSide ? undefined : handleUpload}
        onDeletePress={onSecondSide ? handleDiscardScan : undefined}
        onCalculatePress={onSecondSide ? handleCalculateFromCapture : undefined}
        controlsHidden={busy}
        cameraPaused={isPickingImage}
        cameraRef={cameraRef}
      >
        {/* The sweeping line means "still looking"; once the back side is in
            hand there is nothing left to align. */}
        {backCaptured ? null : <BarcodeOverlay />}
      </ScannerScreenLayout>

    </View>
  );
}
