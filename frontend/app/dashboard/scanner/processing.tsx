import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { UnifiedScanLoader } from '@/components/scanner/UnifiedScanLoader';
import { Colors } from '@/constants/theme';
import { DEFAULT_SCAN_ITEM } from '@/constants/scannerData';
import { isDemoScanMode } from '@/constants/scanMode';
import { useFormulaStore } from '@/store/formulaStore';
import { useScannerStore } from '@/store/scannerStore';
import { ScanStage, type ScanItemData } from '@/types/scanner';
import { ApiError } from '@/utils/apiClient';
import { syncFormulaStoreFromApi } from '@/utils/formulaSettingsApi';
import {
  applyFormula2KaratConstraint,
  readScannedKarat,
  resolveScannedKarat,
} from '@/utils/formulaUtils';
import { analyzeScan, completeDemoCapture, uploadBackImage, uploadFrontImage } from '@/utils/scanApi';
import {
  awaitPricingReady,
  derivePricingInput,
  prefetchFirstPricing,
  seedServerPricing,
} from '@/utils/pricingPrefetch';
import { getBackgroundSideUpload } from '@/utils/uploadPipeline';
import { itemNameForCode, loadItemCatalogue } from '@/utils/itemCatalogue';
import { apiKeyForScanField, structuredDataToScanItem } from '@/utils/scanMappers';
import { fetchGoldRates, fetchLabourRate } from '@/utils/ratesApi';

// The counter runs 0 to 99 over six seconds, showing every digit through
// five labelled sections of twenty digits each, pinned to the wall clock: the
// digit due at any moment comes from elapsed time, so a busy JS thread can
// delay a frame but never stretch the count — it catches up a couple of
// digits per frame instead. Everything happens behind the count: upload, the
// reading, and the first MRP calculation. The last digit — and the hand-off
// to the review card — waits for BOTH the six seconds and the reading with
// its price, so the card always opens complete: a reading that outlives the
// window holds the counter at 99 until it lands, and one that finishes early
// still lets the count run its full six seconds.
// Billing is finalized server-side in the background and never blocks this.
const TICK_MS = 16;
/** How many digits one frame may advance while catching up to the clock. */
const MAX_DIGITS_PER_TICK = 2;
/** The counter's window: six seconds to 99; 100 lands when the reading and price are in hand. */
const EARLY_REVIEW_MS = 6000;
/** How long to wait for the first price after the reading before opening the card regardless. */
const PRICE_WAIT_CAP_MS = 4000;

/** The five sections of the counter; a digit belongs to the last one it reached. */
const SECTIONS = [
  { from: 0, stage: ScanStage.Uploading, message: 'Uploading Tags...' },
  { from: 20, stage: ScanStage.AIProcessing, message: 'Reading the Tag...' },
  { from: 40, stage: ScanStage.AIProcessing, message: 'Analysing Details...' },
  { from: 60, stage: ScanStage.PreparingResults, message: 'Calculating Price...' },
  { from: 80, stage: ScanStage.PreparingResults, message: 'Loading Scanned Results...' },
] as const;

const sectionFor = (digit: number) => {
  for (let i = SECTIONS.length - 1; i >= 0; i -= 1) {
    if (digit >= SECTIONS[i].from) return SECTIONS[i];
  }
  return SECTIONS[0];
};

export default function ProcessingScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const scanId = useScannerStore((s) => s.scanId);
  const frontImageUri = useScannerStore((s) => s.frontImageUri);
  const backImageUri = useScannerStore((s) => s.backImageUri);
  const setUnknownFields = useScannerStore((s) => s.setUnknownFields);
  const setStructuredData = useScannerStore((s) => s.setStructuredData);
  const updateScanData = useScannerStore((s) => s.updateScanData);
  const scanLoading = useScannerStore((s) => s.scanLoading);
  const setScanLoading = useScannerStore((s) => s.setScanLoading);
  const setAnalysisPending = useScannerStore((s) => s.setAnalysisPending);
  const setFieldConfidence = useScannerStore((s) => s.setFieldConfidence);
  const resetScanLoading = useScannerStore((s) => s.resetScanLoading);
  const progressRef = useRef(0);
  const analysisRunKeyRef = useRef<string | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The review screen opens after EARLY_REVIEW_MS whether or not the analysis
  // has returned; these track whether that hand-off already happened.
  const navigatedRef = useRef(false);
  const earlyNavRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The two conditions the hand-off waits for: the six seconds have run, and
  // the reading with its price is stored. Whichever lands second opens the card.
  const windowElapsedRef = useRef(false);
  const analysisReadyRef = useRef(false);
  // Wall-clock marks for the timings shown on the review screen.
  const scanStartRef = useRef(0);
  const uploadDoneRef = useRef(0);
  const analyzeDoneRef = useRef(0);

  const applyClientFormulaRules = useMemo(
    () => (data: ScanItemData): ScanItemData => {
      const { activeFormula, formula2Rules } = useFormulaStore.getState();
      const withKarat = {
        ...data,
        karat: data.karat || resolveScannedKarat(data.karat, data.tunch),
      };

      if (activeFormula !== 'F2') {
        return withKarat;
      }

      const scannedKarat = resolveScannedKarat(withKarat.karat, withKarat.tunch);
      const { karat, requiresDropdown } = applyFormula2KaratConstraint(
        scannedKarat,
        formula2Rules,
      );

      return {
        ...withKarat,
        karat: requiresDropdown ? '' : karat,
      };
    },
    [],
  );

  useEffect(() => {
    progressRef.current = scanLoading.progress;
  }, [scanLoading.progress]);

  /** Advances the counter to `value`, carrying its section's stage and label along. */
  const applyDigit = useCallback(
    (value: number) => {
      const bounded = Math.max(0, Math.min(100, Math.round(value)));
      if (bounded <= progressRef.current) return;
      progressRef.current = bounded;
      const section = sectionFor(bounded);
      setScanLoading({ progress: bounded, stage: section.stage, message: section.message });
    },
    [setScanLoading],
  );


  // Stop the ticker if the screen unmounts mid-run so nothing writes to the
  // store after unmount.
  useEffect(
    () => () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
      if (earlyNavRef.current) clearTimeout(earlyNavRef.current);
    },
    [],
  );

  const runAnalysis = useCallback(async () => {
    if (!isFocused) return;

    if (!scanId || !frontImageUri) {
      console.info('[SCANNER_PROCESSING_MISSING_INPUT]', {
        scanId: scanId ?? null,
        hasFrontImage: Boolean(frontImageUri),
      });
      router.replace('/dashboard/scanner' as Href);
      return;
    }

    const analysisRunKey = `${scanId}|${frontImageUri}|${backImageUri ?? ''}`;
    if (analysisRunKeyRef.current === analysisRunKey) {
      return;
    }
    analysisRunKeyRef.current = analysisRunKey;

    resetScanLoading();
    progressRef.current = 0;
    console.info('[LOADER_PROGRESS]', { scanId, progress: 0, timestamp: Date.now(), stage: 'upload_init' });
    setScanLoading({ progress: 0, stage: SECTIONS[0].stage, message: SECTIONS[0].message });
    scanStartRef.current = Date.now();
    navigatedRef.current = false;
    setAnalysisPending(true);

    // The hand-off fires when both the window and the reading are done —
    // never before either — so the review card opens with values and price.
    windowElapsedRef.current = false;
    analysisReadyRef.current = false;
    const finishIfReady = () => {
      if (!windowElapsedRef.current || !analysisReadyRef.current) return;
      if (navigatedRef.current) return;
      if (useScannerStore.getState().scanId !== scanId) return;
      navigatedRef.current = true;
      if (tickerRef.current) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
      applyDigit(100);
      router.replace('/dashboard/scanner/review-results' as Href);
    };
    if (earlyNavRef.current) clearTimeout(earlyNavRef.current);
    earlyNavRef.current = setTimeout(() => {
      earlyNavRef.current = null;
      windowElapsedRef.current = true;
      finishIfReady();
    }, EARLY_REVIEW_MS);

    // The counter: the digit due now comes from elapsed wall-clock time, and
    // each frame advances at most a couple of digits toward it — so the count
    // is visible digit by digit yet always finishes on schedule, even when
    // uploads keep the JS thread busy. Section labels switch every twenty
    // digits. The last digit lands when the review card opens or the
    // analysis returns.
    if (tickerRef.current) clearInterval(tickerRef.current);
    const ticker = setInterval(() => {
      const elapsed = Date.now() - scanStartRef.current;
      const due = Math.min(99, Math.floor((elapsed / EARLY_REVIEW_MS) * 100));
      if (due > progressRef.current) {
        applyDigit(Math.min(due, progressRef.current + MAX_DIGITS_PER_TICK));
      }
    }, TICK_MS);
    tickerRef.current = ticker;

    try {
      console.info('[IMAGE_UPLOAD_START]', {
        scanId,
        timestamp: Date.now(),
        hasBackImage: Boolean(backImageUri),
      });

      if (isDemoScanMode()) {
        await completeDemoCapture(scanId, Boolean(backImageUri));
      } else {
        // Each side runs its own prepare -> upload chain. A side reuses the
        // background upload ONLY when scanId + imageUri match exactly and it
        // did not fail; anything else re-uploads fresh (identical bytes either way).
        const uploadSide = async (
          side: 'front' | 'back',
          uri: string,
          uploadFn: typeof uploadFrontImage,
        ): Promise<void> => {
          const backgroundUpload = getBackgroundSideUpload(scanId, side, uri);
          if (backgroundUpload) {
            try {
              await backgroundUpload;
              return;
            } catch {
              // Background upload failed; fall back to a fresh prepare + upload.
            }
          }
          await uploadFn(scanId, uri);
        };

        await Promise.all([
          uploadSide('front', frontImageUri, uploadFrontImage),
          backImageUri ? uploadSide('back', backImageUri, uploadBackImage) : Promise.resolve(),
        ]);
      }

      console.info('[LOADER_PROGRESS]', { scanId, timestamp: Date.now(), stage: 'upload_done' });
      uploadDoneRef.current = Date.now();
      console.info('[ANALYZE_REQUEST_START]', {
        scanId,
        timestamp: Date.now(),
      });

      // These requests do not depend on the OCR result. Start them while the
      // tag is being analyzed so the preview does not wait for rate setup.
      const labourRatePromise = fetchLabourRate().catch(() => null);
      // The saved item codes, fetched alongside the analysis so the tag's
      // code can be named the moment the reading lands.
      const cataloguePromise = loadItemCatalogue();
      // Cache warm-up only: the calculate endpoint fetches rates itself, so
      // nothing here waits on it — it used to gate the move to the review
      // screen, which on a slow rates response added seconds after the OCR
      // had already come back.
      if (!isDemoScanMode()) {
        void fetchGoldRates().catch(() => {
          // Warm-up failure is harmless; the review screen fetches on demand.
        });
      }
      const formulaSyncPromise = isDemoScanMode()
        ? Promise.resolve()
        : syncFormulaStoreFromApi().then(
            () => undefined,
            () => {
              // Keep existing formula settings if sync fails.
            },
          );

      const result = await analyzeScan(scanId);
      console.info('[ANALYSIS_RESPONSE_RECEIVED]', {
        scanId,
        timestamp: Date.now(),
      });
      analyzeDoneRef.current = Date.now();
      // Billing now completes server-side in the background: `pending` is the
      // normal fast-path response; `billed` covers older backends.
      if (!isDemoScanMode() && !result.billing?.billed && !result.billing?.pending) {
        throw new ApiError('Scan analysis completed, but billing was not confirmed. Please contact support before retrying.');
      }

      const flatData = result.structuredData ?? {};
      let adjustedScanData = applyClientFormulaRules({
        ...DEFAULT_SCAN_ITEM,
        ...structuredDataToScanItem(flatData),
      });
      // readScannedKarat is empty when the tag carried no karat and no
      // fineness; resolveScannedKarat would have answered 14K here, so the
      // difference between a reading and a default was invisible.
      const extractedKarat = readScannedKarat(adjustedScanData.karat, adjustedScanData.tunch);
      const fallbackKarat = extractedKarat || '14K';
      adjustedScanData = { ...adjustedScanData, karat: fallbackKarat };

      const hasLabourValues = Boolean(adjustedScanData.labourChargeAmount?.trim());

      if (!hasLabourValues) {
        // Errors are already swallowed at kickoff and keep scanned values.
        const labourRate = await labourRatePromise;
        if (labourRate) {
          // Only support AMOUNT type - percentage type removed
          if (labourRate.chargeType === 'AMOUNT') {
            adjustedScanData = {
              ...adjustedScanData,
              labourChargeAmount: String(labourRate.value ?? ''),
              labourChargeUnit:
                labourRate.rupeesUnit ?? adjustedScanData.labourChargeUnit,
              // The rate is set against a chosen weight, so the scan has to
              // charge it against the same one.
              labourWeightBasis:
                labourRate.weightBasis ?? adjustedScanData.labourWeightBasis,
              labourPurityPercent: '',
            };
          }
          // Percentage type no longer supported - ignore it
        }
      }

      // Formulas shape the price the review screen shows, so this one is
      // still awaited; it was started before the analysis and is normally done.
      await formulaSyncPromise;

      // A tag code that is a saved item code names the piece on the card.
      if (adjustedScanData.sku.trim()) {
        const itemName = itemNameForCode(adjustedScanData.sku, await cataloguePromise);
        if (itemName) adjustedScanData = { ...adjustedScanData, itemName };
      }

      // The user may have rescanned while this ran; never write a stale result
      // over a newer session.
      if (useScannerStore.getState().scanId !== scanId) {
        console.info('[ANALYSIS_RESULT_DROPPED_STALE]', { scanId });
        setAnalysisPending(false);
        return;
      }
      // The review card opens before this result arrives, so anything already
      // set on it is a choice made here — the jewellery type, an employee's
      // permitted rate, or a value typed into the card while it waited. The
      // session was reset to DEFAULT_SCAN_ITEM before this scan, so a field
      // that still holds its default is one nobody has touched.
      let keptFields: string[] = [];
      {
        const chosen = useScannerStore.getState().scanData;
        const kept: string[] = [];
        for (const key of Object.keys(adjustedScanData) as (keyof ScanItemData)[]) {
          const isDefault =
            JSON.stringify(chosen[key]) === JSON.stringify(DEFAULT_SCAN_ITEM[key]);
          if (isDefault) continue;
          kept.push(key);
          adjustedScanData = { ...adjustedScanData, [key]: chosen[key] };
        }
        if (kept.length) console.info('[SCAN_KEEPING_USER_VALUES]', { scanId, fields: kept });
        keptFields = kept;
      }

      setUnknownFields(result.unknownFields ?? []);
      setStructuredData({ ...flatData, karat: adjustedScanData.karat });
      // A karat the tag did not print is a default, not a reading: mark it
      // so the review card asks the user to confirm it.
      const fieldConfidence = { ...(result.fieldConfidence ?? {}) };
      // Marked only when the tag carried no karat and nobody chose one: the
      // 14K it shows is this app's default, not something read off the tag.
      if (!extractedKarat && adjustedScanData.karat === fallbackKarat) {
        fieldConfidence.karat = 0;
      } else {
        delete fieldConfidence.karat;
      }
      // A value the user typed is theirs, so it carries no doubt from the
      // reader: marking it would ask them to check their own work.
      for (const field of keptFields) {
        const apiKey = apiKeyForScanField(field as keyof ScanItemData);
        if (apiKey) delete fieldConfidence[apiKey];
      }
      setFieldConfidence(fieldConfidence);
      updateScanData(adjustedScanData);
      setAnalysisPending(false);

      // The server priced the reading inside the analysis: hand that price to
      // the card so it shows the instant the values do, with no round trip.
      if (result.pricing) seedServerPricing(scanId, result.pricing);
      // Also start the card's own first calculation now, while the counter
      // is still running, so its confirmation is already in hand too.
      // Derived exactly the way the pricing hook derives it, or the hook
      // cannot claim this request as its own.
      {
        const state = useScannerStore.getState();
        prefetchFirstPricing(
          scanId,
          derivePricingInput(state.selectedType, state.scanData, state.structuredData),
        );
      }
      // The split the review screen shows: where this scan's seconds went.
      {
        const done = Date.now();
        const start = scanStartRef.current || done;
        const upload = uploadDoneRef.current || start;
        const analyzed = analyzeDoneRef.current || upload;
        setScanLoading({
          timings: {
            uploadMs: Math.max(0, upload - start),
            analyzeMs: Math.max(0, analyzed - upload),
            totalMs: Math.max(0, done - start),
          },
        });
      }
      console.info('[LOADER_PROGRESS]', { scanId, timestamp: Date.now(), stage: 'analysis_stored' });

      // The price: already here when the server priced the reading inside
      // the analysis; otherwise the first calculation just fired is waited
      // for, capped so a slow rate lookup cannot hold the card hostage.
      await Promise.race([
        awaitPricingReady(scanId),
        new Promise<void>((resolve) => setTimeout(resolve, PRICE_WAIT_CAP_MS)),
      ]);
      analysisReadyRef.current = true;
      finishIfReady();
    } catch (error) {
      clearInterval(ticker);
      tickerRef.current = null;
      analysisRunKeyRef.current = null;
      if (earlyNavRef.current) {
        clearTimeout(earlyNavRef.current);
        earlyNavRef.current = null;
      }
      setAnalysisPending(false);
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Scan processing failed. Please try again.';
      Alert.alert('Scan Error', message, [
        {
          text: 'Back to Capture',
          onPress: () => router.replace('/dashboard/scanner/barcode' as Href),
        },
      ]);
    }
  }, [
    scanId,
    frontImageUri,
    backImageUri,
    isFocused,
    router,
    resetScanLoading,
    setScanLoading,
    applyDigit,
    applyClientFormulaRules,
    setUnknownFields,
    setStructuredData,
    setFieldConfidence,
    updateScanData,
  ]);

  useEffect(() => {
    void runAnalysis();
  }, [runAnalysis]);

  return (
    <View style={styles.screen}>
      {/* Mockup: radial-gradient(120% 100% at 50% 30%, #221a12 0%, #0b0906 70%) */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="procBg" cx="50%" cy="30%" rx="120%" ry="100%">
            <Stop offset="0%" stopColor="#221A12" />
            <Stop offset="70%" stopColor={Colors.scannerBg} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#procBg)" />
      </Svg>
      <SafeAreaView style={styles.center}>
        <UnifiedScanLoader
          progress={scanLoading.progress}
          stage={scanLoading.stage}
          message={scanLoading.message}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.scannerBg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
