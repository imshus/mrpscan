import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
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
  createCaptureFlow,
  type CaptureFlowState,
  type SideCapture,
} from '@/utils/captureFlow';
import {
  captureScanImageFallback,
  pickImageFromGallery,
  prewarmImagePreparation,
} from '@/utils/imagePicker';
import { createScan, detectTagArea } from '@/utils/scanApi';
import { createScanSessionSlot } from '@/utils/scanSessionSlot';
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

const IMAGE_REQUIRED_TITLE = 'Image Required';
const IMAGE_REQUIRED_MESSAGE =
  'Please capture a clear photo of the jewellery tag, or upload one from your device.';

type SideHandlers = {
  onReady: (capture: SideCapture<CaptureSource>) => void;
  onFailed: (capture: SideCapture<CaptureSource>, error: unknown) => void;
};

export default function BarcodeScannerScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const cameraRef = useRef<TagCameraPreviewRef>(null);
  const operationStartingRef = useRef(false);
  const selectedType = useScannerStore((s) => s.selectedType);
  const frontImageUri = useScannerStore((s) => s.frontImageUri);
  const setScanId = useScannerStore((s) => s.setScanId);
  const setFrontImageUri = useScannerStore((s) => s.setFrontImageUri);
  const setBackImageUri = useScannerStore((s) => s.setBackImageUri);
  const resetScanLoading = useScannerStore((s) => s.resetScanLoading);
  const resetScanSession = useScannerStore((s) => s.resetScanSession);
  const setScanSessionBootstrapping = useScannerStore((s) => s.setScanSessionBootstrapping);

  // The two sides (utils/captureFlow): a side is held the moment the camera
  // hands its photo back, and its cut to the frame lands behind it. What a
  // ready or failed side sets off is read through a ref, so the flow — made
  // once — always reaches this render's handlers.
  const sideHandlersRef = useRef<SideHandlers | null>(null);
  const [flow] = useState(() =>
    createCaptureFlow<CaptureSource>({
      onReady: (capture) => sideHandlersRef.current?.onReady(capture),
      onFailed: (capture, error) => sideHandlersRef.current?.onFailed(capture, error),
    }),
  );
  const [captureState, setCaptureState] = useState<CaptureFlowState<CaptureSource>>(flow.getState);
  useEffect(() => {
    setCaptureState(flow.getState());
    const unsubscribe = flow.subscribe(setCaptureState);
    return () => {
      unsubscribe();
      // Off the screen, a cut still on its way belongs to no scan.
      flow.discard();
    };
  }, [flow]);

  // The scan session, opened when this screen comes to the front and reused
  // until a scan takes it (utils/scanSessionSlot).
  const [sessionSlot] = useState(() =>
    createScanSessionSlot<CreateScanResponse, JewelleryType>((type) => createScan(type, 'both')),
  );

  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isStartingOperation, setIsStartingOperation] = useState(false);
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

  // Deliberately excludes isPickingImage: the controls must not flicker while
  // the system album is coming up. The tag finder is not in here either — it
  // runs behind the shop and blocks nothing.
  const busy = isStartingOperation;

  const onSecondSide = captureState.step === 'second';
  const backCaptured = Boolean(captureState.back);

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

  /**
   * Opens the scan session unless one for this jewellery type and account is
   * already open (or opening). Failures are swallowed: the next ask — a
   * side's upload, or Calculate — opens it again.
   */
  const ensureScanSession = () => {
    void sessionSlot.ensure(selectedType, currentScopeGeneration());
  };

  useEffect(() => {
    if (!isFocused) return;
    const state = useScannerStore.getState();
    if (!(state.scanId || state.frontImageUri || state.backImageUri)) {
      invalidateBackgroundUploads();
      // A session a dropped photo was sent to still holds that photo; an
      // untouched one is kept, so coming back never opens a second.
      sessionSlot.releaseIfUsed();
      flow.discard();
      setPickedPhoto(null);
      setFindingTag(false);
      pickedUriRef.current = null;
      captureTokenRef.current += 1;
      refineRef.current = {};
      setRefining({ front: false, back: false });
      setIsPickingImage(false);
      setIsStartingOperation(false);
    }
    // The session opens while the shop is still lining up the tag, not on
    // the first photo: by the time a side is cut its upload has somewhere to
    // go, and Calculate has no session to wait for.
    ensureScanSession();
  }, [isFocused]);

  /**
   * A side's file is ready — the camera photo cut to the frame, a gallery
   * photo, or the finder's better cut of one. Its upload starts now, while
   * the shop lines up the other side or decides, so Calculate has less left
   * to wait for. A side dropped or replaced in the meantime sends nothing.
   *
   * Started right here, not after interactions: the screen moved on when the
   * side was held, well before its cut lands, and a Calculate waiting on this
   * very cut must find the upload already under way rather than send the
   * same side a second time.
   */
  const handleSideReady = (capture: SideCapture<CaptureSource>) => {
    const uri = capture.uri;
    if (!uri || !flow.isCurrent(capture)) return;
    prewarmImagePreparation(uri);
    // Same side, new file: the pipeline aborts the earlier upload and
    // carries this one instead.
    startBackgroundSideUpload(
      sessionSlot.claimForUpload(selectedType, currentScopeGeneration(), capture.side),
      capture.side,
      uri,
    );
  };

  /** The cut to the frame failed: the side is already dropped, so it is simply taken again. */
  const handleSideFailed = (capture: SideCapture<CaptureSource>, error: unknown) => {
    console.warn(`Could not cut the ${capture.side} capture to the frame; retake it:`, error);
    // A retake whose cut failed leaves the earlier photo of that side in the
    // session, where a scan without that side would still read it: as after
    // a discard, that session is let go, and the sides still held go up to a
    // clean one.
    if (sessionSlot.releaseIfUsed(capture.side)) {
      invalidateBackgroundUploads();
      ensureScanSession();
      const { front, back } = flow.getState();
      for (const kept of [front, back]) {
        if (kept) handleSideReady(kept);
      }
    }
    Alert.alert(IMAGE_REQUIRED_TITLE, IMAGE_REQUIRED_MESSAGE);
  };

  sideHandlersRef.current = { onReady: handleSideReady, onFailed: handleSideFailed };

  const startScanOperation = async () => {
    if (operationStartingRef.current) return;
    const held = flow.getState();
    if (!held.front) return;

    console.info('[CALCULATE_PRESSED]', {
      timestamp: Date.now(),
      source: (held.back ?? held.front).source,
      hasBackImage: Boolean(held.back),
    });

    operationStartingRef.current = true;
    setIsStartingOperation(true);
    setScanSessionBootstrapping(true);
    const issuedAt = currentScopeGeneration();
    try {
      resetScanSession();
      resetScanLoading();
      // The session (open since the screen came up) and the sides' cut files
      // are waited for together; the cuts are usually in hand already.
      const sessionPromise = sessionSlot.ensure(selectedType, issuedAt);
      const [sides, prewarmedSession] = await Promise.all([
        flow.whenReady(),
        sessionPromise.then(
          (session) => session,
          () => null,
        ),
      ]);
      // A side could not be cut: it was dropped and the shop told, so it can
      // be taken again. The session stays open for that.
      if (!sides) return;
      sessionSlot.release(sessionPromise);
      // Prewarm failed; fall back to creating the session on demand.
      const session = prewarmedSession ?? (await createScan(selectedType, 'both'));
      console.info('[SCAN_ID_READY]', {
        scanId: session.scanId,
        timestamp: Date.now(),
      });
      console.info('[SCAN_OPERATION_START]', {
        scanId: session.scanId,
        jewelleryType: selectedType,
        source: sides.source,
        hasBackImage: Boolean(sides.back),
      });
      // The account changed while the session was being opened: this scan
      // and its photographs are the previous account's, not the next one's.
      if (issuedAt !== currentScopeGeneration()) return;
      setScanId(session.scanId);
      setFrontImageUri(sides.front);
      setBackImageUri(sides.back);
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

  const resolveCapture = async (): Promise<TagCapture | null> => {
    const live = await cameraRef.current?.takePicture();
    if (live) return live;

    // The web fallback yields one photo; it stands in for both.
    const fallback = await captureScanImageFallback();
    return fallback ? { full: fallback, framed: Promise.resolve(fallback) } : null;
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
   * the token and the side's own capture both have to still match.
   */
  const refineSide = (
    capture: SideCapture<CaptureSource>,
    fullUri: string,
    upright?: UprightImage | null,
    detection?: Promise<string> | null,
  ) => {
    const side = capture.side;
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

        // The swap is refused when the side was replaced or dropped; when it
        // is taken, the new file's thumbnail and upload follow from it.
        flow.swap(capture, cropped);
      } catch (error) {
        console.warn('Tag finder failed; the side stays as captured:', error);
      } finally {
        if (refineRef.current[side] === work) delete refineRef.current[side];
        setRefining((prev) => ({ ...prev, [side]: false }));
      }
    })();
    refineRef.current[side] = work;
  };

  /** The side the next photo is for: the back once the front is held. */
  const nextSide = () => (flow.getState().step === 'second' ? 'back' : 'front');

  /** Keeps what the frame is showing of the uploaded photo, cropped to it. */
  const useFramedPhoto = async () => {
    const photo = pickedPhoto;
    if (!photo) return;
    const cropped = await adjustRef.current?.exportAdjusted();
    const uri = cropped ?? photo.uri;
    pickedUriRef.current = null;
    setFindingTag(false);
    setPickedPhoto(null);
    flow.confirm(nextSide(), photo.source, uri);
    ensureScanSession();
  };

  const handleShutter = async () => {
    if (busy) return;

    if (pickedPhoto) {
      await useFramedPhoto();
      return;
    }

    // One press, one photo: the shutter is held until the camera answers,
    // and a tap in that moment is ignored rather than queued.
    const ticket = flow.beginShutter();
    if (!ticket) return;
    try {
      let capture: TagCapture | null = null;
      try {
        capture = await resolveCapture();
      } catch (error) {
        console.warn('Capture failed:', error);
      }
      if (!capture) {
        Alert.alert(IMAGE_REQUIRED_TITLE, IMAGE_REQUIRED_MESSAGE);
        return;
      }

      // The side is held now, while its cut to the frame is still running:
      // the screen moves on at once, and the thumbnail, upload and Calculate
      // each wait for the cut themselves. The framed photo is what the shop
      // lined up, and it is what goes up: no finder runs behind a camera
      // capture, at the shop's asking. The finder still cuts a gallery photo
      // to its tag, since nobody framed it.
      const held = flow.confirm(ticket.side, 'camera', capture.framed, ticket);
      if (held) ensureScanSession();
      // Discarded while the camera answered: nobody waits on this cut.
      else capture.framed.catch(() => undefined);
    } finally {
      flow.endShutter(ticket);
    }
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
    // A session the dropped photos were sent to would read them with the
    // next ones: it is let go and a clean one opened. An untouched one stays.
    sessionSlot.releaseIfUsed();
    flow.discard();
    setFrontImageUri(null);
    setBackImageUri(null);
    ensureScanSession();
  };

  /** Calculate from the capture screen: with the back side when it was taken. */
  const handleCalculateFromCapture = async () => {
    if (busy) return;
    if (!flow.getState().front) return;
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
    // The sides' cuts to the frame — and a press still waiting on the
    // camera — are waited for inside, alongside the session.
    void startScanOperation();
  };

  const handleUpload = async () => {
    if (busy || isPickingImage) return;
    // The camera is still answering a press: the album would take the camera
    // away from under it.
    if (flow.getState().shutterBusy) return;

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
      const capture = flow.confirm(nextSide(), 'gallery', uri);
      ensureScanSession();
      if (capture) refineSide(capture, uri);
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
        shutterBusy={captureState.shutterBusy}
        onUploadPress={onSecondSide || pickedPhoto ? undefined : handleUpload}
        onDeletePress={onSecondSide || pickedPhoto ? handleDiscardScan : undefined}
        onCalculatePress={onSecondSide && !pickedPhoto ? handleCalculateFromCapture : undefined}
        calculateDisabled={refining.front || refining.back}
        // The side already taken, ticked, above the frame: the screen asks
        // for the back of the tag while showing the front is safely in hand.
        // The capture path holds that side locally until the scan starts, so
        // the store's uri alone left the camera flow with no thumbnail. It
        // appears once the front's cut to the frame has landed.
        capturedPreviewUri={
          onSecondSide && !pickedPhoto
            ? captureState.front
              ? captureState.front.uri
              : frontImageUri
            : undefined
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
