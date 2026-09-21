import { useEffect, useRef, useState } from 'react';
import { Alert, InteractionManager, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { AdjustableImage, type AdjustableImageRef } from '@/components/scanner/AdjustableImage';
import { BarcodeOverlay } from '@/components/scanner/BarcodeOverlay';
import { type CaptureSource } from '@/components/scanner/CapturedSidesStrip';
import { ScannerScreenLayout } from '@/components/scanner/ScannerScreenLayout';
import type { TagCameraPreviewRef, TagCapture } from '@/components/scanner/TagCameraPreview';
import { useScannerStore } from '@/store/scannerStore';
import type { CreateScanResponse, JewelleryType } from '@/types/scanner';
import { ApiError } from '@/utils/apiClient';
import {
  captureScanImageFallback,
  pickImageFromGallery,
  prewarmImagePreparation,
} from '@/utils/imagePicker';
import { createScan, detectTagArea } from '@/utils/scanApi';
import { cropToTagBox, detectionCopy, uprightCopy, withTimeout } from '@/utils/tagCrop';
import { currentScopeGeneration } from '@/utils/userScopedStorage';
import { invalidateBackgroundUploads, startBackgroundSideUpload } from '@/utils/uploadPipeline';

type ConfirmedCapture = {
  uri: string;
  source: CaptureSource;
};

/**
 * How long a live capture waits for the tag finder before going with the
 * frame the shop lined up. The finder usually answers in a few seconds; a
 * slow network must not turn a tap of the shutter into a stall.
 */
const AUTO_FRAME_TIMEOUT_MS = 8000;

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
  const frontImageUri = useScannerStore((s) => s.frontImageUri);
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
  // Bumped whenever the sides are dropped, so a tag search still running for
  // a capture the shop has since discarded cannot confirm it afterwards.
  const captureTokenRef = useRef(0);

  // While the tag is being found nothing may be captured, used or calculated
  // on top of it. isPickingImage stays out: the controls must not flicker
  // while the system album is coming up.
  const busy = isStartingOperation || findingTag;

  const onSecondSide = captureStep === 'second';
  const backCaptured = Boolean(confirmedBack);

  const instruction = findingTag
    ? 'Finding the tag…'
    : pickedPhoto
      ? 'Drag and pinch so only the tag fills the frame'
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
    captureTokenRef.current += 1;
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
    const issuedAt = currentScopeGeneration();
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
      // The account changed while the session was being opened: this scan
      // and its photographs are the previous account's, not the next one's.
      if (issuedAt !== currentScopeGeneration()) return;
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

  const resolveCapture = async (): Promise<TagCapture | null> => {
    const live = await cameraRef.current?.takePicture();
    if (live) return live;

    // The web fallback yields one photo; it stands in for both.
    const fallback = await captureScanImageFallback();
    return fallback ? { framed: fallback, full: fallback } : null;
  };

  /**
   * Finds the white tag in the whole capture and cuts to it, so the shop
   * does not have to line the tag up inside the frame — off-centre, small or
   * tilted, it still comes out as the tag alone. Anything short of a clean
   * answer (no tag seen, a slow or refused finder, a crop that fails) falls
   * back to the frame the shop lined up, so a capture is never lost to the
   * attempt. Null means the shop discarded the capture while it was being
   * searched, and nothing should be confirmed.
   */
  const autoFrame = async (capture: TagCapture): Promise<string | null> => {
    const token = captureTokenRef.current;
    setFindingTag(true);
    try {
      const upright = await uprightCopy(capture.full);
      if (!upright) return capture.framed;
      // The finder is shown a small copy of the very file that gets cut, so
      // its fractions land exactly where it saw the tag — and it answers in
      // a fraction of the time a full-size upload took.
      const box = await withTimeout(
        detectTagArea(await detectionCopy(upright)),
        AUTO_FRAME_TIMEOUT_MS,
      );
      if (token !== captureTokenRef.current) return null;
      if (!box) return capture.framed;
      return (await cropToTagBox(upright, box)) ?? capture.framed;
    } catch (error) {
      console.warn('Tag finder failed; using the framed capture:', error);
      return token === captureTokenRef.current ? capture.framed : null;
    } finally {
      setFindingTag(false);
    }
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

    const capture = await resolveCapture();
    if (!capture) {
      Alert.alert(
        'Image Required',
        'Please capture a clear photo of the jewellery tag, or upload one from your device.',
      );
      return;
    }

    const uri = await autoFrame(capture);
    if (!uri) return;

    if (captureStep === 'second') {
      confirmBackCapture(uri, 'camera');
      return;
    }

    confirmFrontCapture(uri, 'camera');
  };

  /** The bin beside the frame: drop the framed photo, or the scan itself. */
  const handleDiscardScan = () => {
    captureTokenRef.current += 1;
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
      // The tag is usually a small part of a gallery photo. The finder finds
      // it, the photo is cut to it, and that side is taken — no tap. Only
      // when the finder comes up empty does the frame stay for a nudge.
      pickedUriRef.current = uri;
      setFindingTag(true);
      void (async () => {
        // Upright first, and the finder looks at that same copy, so where it
        // says the tag is and where the cut is made agree even on a photo
        // carrying a rotation tag.
        const upright = await uprightCopy(uri);
        const box = upright ? await detectTagArea(await detectionCopy(upright)) : null;
        if (pickedUriRef.current !== uri) return;
        const cropped = upright && box ? await cropToTagBox(upright, box) : null;
        if (pickedUriRef.current !== uri) return;
        setFindingTag(false);
        if (!cropped) {
          // Nothing found, or the cut failed: the frame goes to the finder's
          // best guess if it made one, and the shop nudges it from there.
          if (box) adjustRef.current?.frameRegion(box);
          return;
        }
        pickedUriRef.current = null;
        setPickedPhoto(null);
        if (captureStep === 'second') confirmBackCapture(cropped, 'gallery');
        else confirmFrontCapture(cropped, 'gallery');
      })().catch((error) => {
        if (pickedUriRef.current !== uri) return;
        setFindingTag(false);
        Alert.alert(
          'Find the tag',
          error instanceof Error ? error.message : 'Could not find the tag automatically.',
        );
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
        // The side already taken, ticked, above the frame: the screen asks
        // for the back of the tag while showing the front is safely in hand.
        // The capture path holds that side locally until the scan starts, so
        // the store's uri alone left the camera flow with no thumbnail.
        capturedPreviewUri={
          onSecondSide && !pickedPhoto ? confirmedFront?.uri ?? frontImageUri : undefined
        }
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
