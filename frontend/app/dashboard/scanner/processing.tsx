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
  resolveScannedKarat,
} from '@/utils/formulaUtils';
import { analyzeScan, completeDemoCapture, uploadBackImage, uploadFrontImage } from '@/utils/scanApi';
import { getBackgroundSideUpload } from '@/utils/uploadPipeline';
import { structuredDataToScanItem } from '@/utils/scanMappers';
import { fetchLabourRate } from '@/utils/ratesApi';

// The percentage page runs on a fixed 2-second clock: 0 -> 96% over 2s with
// time-based stage labels, holding at 96% only if the backend needs longer.
// Billing is finalized server-side in the background and never blocks this.
const MIN_PROCESSING_MS = 2000;
const TICK_MS = 50;
const HOLD_PROGRESS = 96;

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
  const resetScanLoading = useScannerStore((s) => s.resetScanLoading);
  const progressRef = useRef(0);
  const stageRef = useRef<ScanStage | null>(null);
  const analysisRunKeyRef = useRef<string | null>(null);

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

  const setProgress = useCallback(
    (value: number) => {
      const bounded = Math.max(0, Math.min(100, Math.round(value)));
      const current = progressRef.current;
      if (bounded <= current) return;
      progressRef.current = bounded;
      setScanLoading({ progress: bounded });
    },
    [setScanLoading],
  );

  const setStage = useCallback(
    (stage: ScanStage, message: string) => {
      if (stageRef.current === stage) return;
      stageRef.current = stage;
      setScanLoading({ stage, message });
    },
    [setScanLoading],
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
    stageRef.current = null;
    console.info('[LOADER_PROGRESS]', { scanId, progress: 0, timestamp: Date.now(), stage: 'upload_init' });
    setStage(ScanStage.Uploading, 'Uploading Tags...');
    setScanLoading({ progress: 0 });

    // Fixed pacing clock (MIN_PROCESSING_MS) — progress and stage labels are
    // driven purely by elapsed time so the page always animates the same way.
    const startedAt = Date.now();
    const ticker = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const target = Math.min(HOLD_PROGRESS, (elapsed / MIN_PROCESSING_MS) * HOLD_PROGRESS);
      setProgress(target);
      if (target >= 72) {
        setStage(ScanStage.PreparingResults, 'Loading Scanned Results...');
      } else if (target >= 36) {
        setStage(ScanStage.AIProcessing, 'Processing Tag Details...');
      }
    }, TICK_MS);

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
      console.info('[ANALYZE_REQUEST_START]', {
        scanId,
        timestamp: Date.now(),
      });

      // Kick off independent fetches alongside analysis; their results are awaited later.
      const labourRatePromise = fetchLabourRate().catch(() => null);
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
      const extractedKarat = resolveScannedKarat(adjustedScanData.karat, adjustedScanData.tunch);
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
              labourPurityPercent: '',
            };
          }
          // Percentage type no longer supported - ignore it
        }
      }

      await formulaSyncPromise;

      setUnknownFields(result.unknownFields ?? []);
      setStructuredData({ ...flatData, karat: fallbackKarat });
      updateScanData(adjustedScanData);

      // Keep the page on screen for the full fixed 3 seconds even when the
      // backend finishes earlier, so the animation always completes smoothly.
      const remainingMs = MIN_PROCESSING_MS - (Date.now() - startedAt);
      if (remainingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingMs));
      }

      clearInterval(ticker);
      setProgress(100);
      console.info('[LOADER_PROGRESS]', { scanId, progress: 100, timestamp: Date.now(), stage: 'completed' });
      setStage(ScanStage.Completed, 'Loading Scanned Results...');
      router.replace('/dashboard/scanner/review-results' as Href);
    } catch (error) {
      clearInterval(ticker);
      analysisRunKeyRef.current = null;
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
    setProgress,
    setStage,
    applyClientFormulaRules,
    setUnknownFields,
    setStructuredData,
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
        <UnifiedScanLoader progress={scanLoading.progress} stage={scanLoading.stage} />
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
