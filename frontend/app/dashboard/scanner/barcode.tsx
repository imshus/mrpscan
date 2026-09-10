import { useEffect, useRef, useState } from 'react';
import { Alert, InteractionManager, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { AdjustableImage, type AdjustableImageRef } from '@/components/scanner/AdjustableImage';
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
import { createScan, detectTagArea } from '@/utils/scanApi';
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
  // An uploaded photo is framed in the capture frame itself: the frame is the
  // crop, so the tag ends up filling it exactly as a live capture would.
  const [pickedPhoto, setPickedPhoto] = useState<ConfirmedCapture | null>(null);
  const [findingTag, setFindingTag] = useState(false);
  const adjustRef = useRef<AdjustableImageRef>(null);
  // The photo the detection was started for, so a slower answer cannot move a
  // photo the user has since replaced or dropped.
  const pickedUriRef = useRef<string | null>(null);

  // Deliberately excludes isPickingImage: the controls must not flicker while
  // the system album is coming up.
  const busy = isStartingOperation;

  const onSecondSide = captureStep === 'second';
  const backCaptured = Boolean(confirmedBack);

  const instruction = pickedPhoto
    ? findingTag
      ? 'Finding the tag in your photo…'
      : 'Drag and pinch so only the tag fills the frame'
    : !onSecondSide
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
    setPickedPhoto(null);
    setFindingTag(false);
    pickedUriRef.current = null;
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

  /** Keeps what the frame is showing of the uploaded photo, cropped to it. */
  const useFramedPhoto = async () => {
    const photo = pickedPhoto;
    if (!photo) return;
    const cropped = await adjustRef.current?.exportAdjusted();
    const uri = cropped ?? photo.uri;
    pickedUriRef.current = null;
    setFindingTag(false);
    setPickedPhoto(null);
    if (captureStep === 'second') confirmBackCapture(uri, photo.source);
    else confirmFrontCapture(uri, photo.source);
  };

  const handleShutter = async () => {
    if (busy) return;

    if (pickedPhoto) {
      await useFramedPhoto();
      return;
    }

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

  /** The bin beside the frame: drop the framed photo, or the scan itself. */
  const handleDiscardScan = () => {
    if (pickedPhoto) {
      pickedUriRef.current = null;
      setFindingTag(false);
      setPickedPhoto(null);
      return;
    }
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
      setPickedPhoto({ uri, source: 'gallery' });
      // The tag is usually a small part of a gallery photo. The reader finds
      // it and the frame goes to it, leaving the user only a nudge to make.
      pickedUriRef.current = uri;
      setFindingTag(true);
      void detectTagArea(uri).then((box) => {
        if (pickedUriRef.current !== uri) return;
        setFindingTag(false);
        if (box) adjustRef.current?.frameRegion(box);
      });
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
        shutterLabel={pickedPhoto ? 'Use this tag' : onSecondSide ? 'Click for 2nd side' : 'Click'}
        shutterTone={pickedPhoto || !onSecondSide ? 'primary' : 'secondary'}
        onUploadPress={onSecondSide || pickedPhoto ? undefined : handleUpload}
        onDeletePress={onSecondSide || pickedPhoto ? handleDiscardScan : undefined}
        onCalculatePress={onSecondSide && !pickedPhoto ? handleCalculateFromCapture : undefined}
        photoLayer={
          pickedPhoto
            ? (frame) => (
                <AdjustableImage
                  ref={adjustRef}
                  uri={pickedPhoto.uri}
                  cropRect={frame}
                  style={StyleSheet.absoluteFill}
                />
              )
            : undefined
        }
        controlsHidden={busy}
        cameraPaused={isPickingImage || Boolean(pickedPhoto)}
        cameraRef={cameraRef}
      >
        {backCaptured || pickedPhoto ? null : (
          // The sweeping line means "still looking"; once a side is in hand
          // there is nothing left to align.
          <BarcodeOverlay />
        )}
      </ScannerScreenLayout>

    </View>
  );
}
