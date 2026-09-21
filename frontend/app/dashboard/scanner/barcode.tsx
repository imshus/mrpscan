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
import {
  cropToTagBox,
  detectionCopy,
  uprightCopy,
  withTimeout,
  type UprightImage,
} from '@/utils/tagCrop';
import { currentScopeGeneration } from '@/utils/userScopedStorage';
import { invalidateBackgroundUploads, startBackgroundSideUpload } from '@/utils/uploadPipeline';

type ConfirmedCapture = {
  uri: string;
  source: CaptureSource;
};

/**
 * How long the tag finder gets before a side is left as captured. It runs
 * behind the shop now, not in front of it, so this bounds wasted work, not
 * a wait: the side is already confirmed and the shop already moved on.
 * Generous on purpose — while the server's finder still thinks at full
 * effort, eight seconds abandoned answers that were seconds from landing.
 */
const AUTO_FRAME_TIMEOUT_MS = 15000;

/**
 * How long Calculate waits for a finder still running on either side: not
 * at all. It was three seconds, and with the finder on the server still
 * thinking at full effort those three seconds were paid on nearly every
 * Calculate — a stall the shop felt every time. The finder is a bonus: when
 * it has landed its crop is used, and when it has not the side goes up as
 * captured, which is exactly what the reader always used to get.
 */
const REFINE_WAIT_AT_CALCULATE_MS = 0;

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
  // a capture the shop has since discarded cannot swap it afterwards.
  const captureTokenRef = useRef(0);
  // The finders still working, per side. Calculate waits on these briefly;
  // the instruction line mentions them; nothing is blocked by them.
  const refineRef = useRef<{ front?: Promise<void>; back?: Promise<void> }>({});
  const [refining, setRefining] = useState<{ front: boolean; back: boolean }>({
    front: false,
    back: false,
  });
  // Mirrors of the confirmed sides that an awaited path can read after its
  // await, when the render it closed over may be stale.
  const confirmedFrontRef = useRef<ConfirmedCapture | null>(null);
  const confirmedBackRef = useRef<ConfirmedCapture | null>(null);
  useEffect(() => {
    confirmedFrontRef.current = confirmedFront;
  }, [confirmedFront]);
  useEffect(() => {
    confirmedBackRef.current = confirmedBack;
  }, [confirmedBack]);

  // Deliberately excludes isPickingImage: the controls must not flicker while
  // the system album is coming up. The tag finder is not in here either — it
  // runs behind the shop and blocks nothing.
  const busy = isStartingOperation;

  const onSecondSide = captureStep === 'second';
  const backCaptured = Boolean(confirmedBack);

  const baseInstruction = pickedPhoto
    ? 'Drag and pinch so only the tag fills the frame'
    : !onSecondSide
      ? 'Align jewellery tag inside frame'
      : backCaptured
        ? 'Back side captured — tap Calculate to continue'
        : 'Align back side of tag inside frame';
  const instruction =
    refining.front || refining.back
      ? `Adjusting tag in background · ${baseInstruction}`
      : baseInstruction;

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
    refineRef.current = {};
    setRefining({ front: false, back: false });
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
    return fallback ? { framed: fallback, full: fallback, upright: null, detection: null } : null;
  };

  /**
   * Finds the white tag in the whole photo and cuts to it, behind the shop's
   * back: the side is already confirmed with what was captured, and the shop
   * is already lining up the next one. When the finder lands — usually in
   * those same seconds — the crop replaces the side, its thumbnail, and its
   * upload, which the pipeline supersedes cleanly. When it does not (no tag
   * seen, a slow or refused finder, a crop that fails) the side simply stays
   * as captured, exactly what it was before there was a finder at all.
   *
   * Nothing is swapped behind a side the shop has since replaced or dropped:
   * the token and the uri both have to still match.
   */
  const refineSide = (
    side: 'front' | 'back',
    fullUri: string,
    confirmedUri: string,
    source: CaptureSource,
    upright?: UprightImage | null,
    detection?: Promise<string> | null,
  ) => {
    const token = captureTokenRef.current;
    setRefining((prev) => ({ ...prev, [side]: true }));
    // Declared before the closure that names it: the finally below compares
    // against it, and a const initialised by that same closure is not yet
    // assigned in the compiler's eyes. At run time it is, since the closure
    // cannot reach its finally before its first await returns.
    let work: Promise<void> | undefined;
    work = (async () => {
      try {
        // A camera capture arrives with its upright size already known —
        // the framing just measured it — so the cut is made from that very
        // file. Re-saving a whole photo only to learn its size was the
        // slowest thing the phone did here, on every capture, and it ran
        // alongside the finder's copy and slowed that down too. A gallery
        // photo's size is unknown, so it still gets the copy, made during
        // the network wait and only awaited once there is a box to cut.
        const uprightPromise = upright ? Promise.resolve(upright) : uprightCopy(fullUri);
        // A camera capture's small copy has been in the making since the
        // shutter; a gallery photo's is made here.
        const smallUri = await (detection ?? detectionCopy(fullUri, upright ?? undefined));
        const box = await withTimeout(detectTagArea(smallUri), AUTO_FRAME_TIMEOUT_MS);
        if (!box || token !== captureTokenRef.current) return;
        const photo = await uprightPromise;
        if (!photo) return;
        const cropped = await cropToTagBox(photo, box);
        if (!cropped || token !== captureTokenRef.current) return;

        const current = side === 'front' ? confirmedFrontRef.current : confirmedBackRef.current;
        if (!current || current.uri !== confirmedUri) return;

        const swapped = { uri: cropped, source };
        if (side === 'front') setConfirmedFront(swapped);
        else setConfirmedBack(swapped);
        prewarmImagePreparation(cropped);
        const prewarmedSession = scanSessionPrewarmRef.current;
        if (prewarmedSession && prewarmedSession.jewelleryType === selectedType) {
          // Same side, new file: the pipeline aborts the earlier upload and
          // carries this one instead.
          startBackgroundSideUpload(prewarmedSession.promise, side, cropped);
        }
      } catch (error) {
        console.warn('Tag finder failed; the side stays as captured:', error);
      } finally {
        if (refineRef.current[side] === work) delete refineRef.current[side];
        setRefining((prev) => ({ ...prev, [side]: false }));
      }
    })();
    refineRef.current[side] = work;
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

    // The framed photo is taken on the spot — the screen moves on with no
    // wait at all — and the finder works on the whole photo behind it.
    const side = captureStep === 'second' ? 'back' : 'front';
    if (side === 'back') confirmBackCapture(capture.framed, 'camera');
    else confirmFrontCapture(capture.framed, 'camera');
    refineSide(side, capture.full, capture.framed, 'camera', capture.upright, capture.detection);
  };

  /** The bin beside the frame: drop the framed photo, or the scan itself. */
  const handleDiscardScan = () => {
    captureTokenRef.current += 1;
    refineRef.current = {};
    setRefining({ front: false, back: false });
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
  const handleCalculateFromCapture = async () => {
    if (busy) return;
    if (!confirmedFront) return;
    // The pill is held while a side is still being adjusted; this is the
    // same rule for a press that slips through as the state changes.
    if (refining.front || refining.back) return;
    // A finder still at work is given a short moment; past that the sides go
    // up as captured, which is what the reader always used to get.
    const pending = Object.values(refineRef.current);
    if (pending.length > 0 && REFINE_WAIT_AT_CALCULATE_MS > 0) {
      setIsStartingOperation(true);
      try {
        await withTimeout(Promise.all(pending), REFINE_WAIT_AT_CALCULATE_MS);
      } finally {
        setIsStartingOperation(false);
      }
    }
    const front = confirmedFrontRef.current;
    const back = confirmedBackRef.current;
    if (!front) return;
    void startScanOperation(front.uri, back?.uri ?? null, back?.source ?? front.source);
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
      // The photo is taken as it is, the screen moves on, and the finder cuts
      // it to the tag behind the shop's back. The drag-and-pinch adjuster is
      // no longer entered on this path: the shop asked for no tapping and no
      // waiting, and a photo the finder cannot place still reads — the
      // reader magnifies parts of whatever it is given.
      const side = captureStep === 'second' ? 'back' : 'front';
      if (side === 'back') confirmBackCapture(uri, 'gallery');
      else confirmFrontCapture(uri, 'gallery');
      refineSide(side, uri, uri, 'gallery');
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
        calculateDisabled={refining.front || refining.back}
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
