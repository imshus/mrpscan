import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  View,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { ReviewScannedResultsModal } from '@/components/scanner/ReviewScannedResultsModal';
import { isDemoScanMode } from '@/constants/scanMode';
import { useFinalTabPricing } from '@/hooks/useFinalTabPricing';
import { useScannerStore } from '@/store/scannerStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useAuthStore } from '@/store/authStore';
import { fetchEmployeePermissions } from '@/utils/authApi';
import { mapApiPermissionsToEmployee } from '@/utils/employeeApi';
import type { EmployeePermissions } from '@/types/employee';
import type { ScanItemData, StoneEntry } from '@/types/scanner';
import { ApiError } from '@/utils/apiClient';
import { submitReview } from '@/utils/scanApi';
import { invalidateBackgroundUploads } from '@/utils/uploadPipeline';
import { scanItemToStructuredData } from '@/utils/scanMappers';
import {
  applyStoneEntriesToScanData,
  parseStoneArraysFromStructuredData,
  stoneEntriesToStructuredData,
} from '@/utils/stoneSequenceUtils';
import { buildWishlistItem } from '@/utils/wishlistUtils';

// How long after the last keystroke the structured-data mirror catches up.
// Shorter than the pricing hook's 350ms debounce so the price request that
// follows an edit always sees the synced mirror.
const STRUCTURED_SYNC_MS = 250;

export default function ReviewResultsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const scanId = useScannerStore((s) => s.scanId);
  const scanData = useScannerStore((s) => s.scanData);
  const selectedType = useScannerStore((s) => s.selectedType);
  const structuredData = useScannerStore((s) => s.structuredData);
  const updateScanData = useScannerStore((s) => s.updateScanData);
  const bumpMrpRefresh = useScannerStore((s) => s.bumpMrpRefresh);
  const setStructuredData = useScannerStore((s) => s.setStructuredData);
  const setScanSessionBootstrapping = useScannerStore((s) => s.setScanSessionBootstrapping);
  const resetScanSession = useScannerStore((s) => s.resetScanSession);
  const addWishlistItem = useWishlistStore((s) => s.addItem);
  const userRole = useAuthStore((s) => s.userRole);
  const isSuper = useAuthStore((s) => s.isSuper);
  const [addingToWishlist, setAddingToWishlist] = useState(false);
  const [hasAddedToWishlist, setHasAddedToWishlist] = useState(false);
  const [employeePermissions, setEmployeePermissions] = useState<EmployeePermissions | null>(null);

  useEffect(() => {
    let active = true;
    if (userRole !== 'employee' || isSuper) {
      setEmployeePermissions(null);
      return () => {
        active = false;
      };
    }

    const loadPermissions = async () => {
      const result = await fetchEmployeePermissions();
      if (!active) return;
      if (result.success && result.data?.permissions) {
        const mappedPermissions = mapApiPermissionsToEmployee(result.data.permissions);
        setEmployeePermissions(mappedPermissions);

        const allowRtgs = mappedPermissions.scan_rate_rtgs === true;
        const allowCash = mappedPermissions.scan_rate_cash === true;
        if (allowRtgs !== allowCash) {
          const forcedRate = allowCash ? 'cash' : 'rtgs';
          updateScanData({ calculationRate: forcedRate });
        }
        return;
      }
      setEmployeePermissions(null);
    };

    void loadPermissions();
    return () => {
      active = false;
    };
  }, [userRole, isSuper, updateScanData]);

  const isEmployeeRestricted = userRole === 'employee' && !isSuper;
  const canEditPurityPercent =
    !isEmployeeRestricted || employeePermissions?.scan_edit_purity_percent === true;
  const calculationRateAccess = useMemo(() => {
    if (!isEmployeeRestricted) return 'both' as const;
    if (!employeePermissions) return 'rtgs' as const;
    const allowRtgs = employeePermissions?.scan_rate_rtgs === true;
    const allowCash = employeePermissions?.scan_rate_cash === true;
    if (allowRtgs && allowCash) return 'both' as const;
    if (allowRtgs) return 'rtgs' as const;
    if (allowCash) return 'cash' as const;
    return 'both' as const;
  }, [employeePermissions, isEmployeeRestricted]);

  const livePricing = useFinalTabPricing({
    scanData,
    structuredData,
    selectedType,
  });

  // This is the screen the scanner lands on and the one Generate Invoice is
  // pressed from, so it is what hands the invoice its figures. Without this the
  // invoice reads an empty store and bills zero.
  const setPreviewPricing = useScannerStore((state) => state.setPreviewPricing);
  const analysisPending = useScannerStore((state) => state.analysisPending);
  useEffect(() => {
    setPreviewPricing(livePricing);
  }, [livePricing, setPreviewPricing]);

  const { diamonds, colorstones } = useMemo(
    () => parseStoneArraysFromStructuredData(structuredData, scanData),
    [structuredData, scanData],
  );

  const resetCurrentScanOperation = useCallback((reason: string) => {
    const currentScanId = useScannerStore.getState().scanId;
    console.info('[SCAN_OPERATION_RESET]', {
      scanId: currentScanId,
      reason,
    });
    resetScanSession();
    invalidateBackgroundUploads();
    setScanSessionBootstrapping(false);
    router.replace('/dashboard/scanner' as Href);
  }, [resetScanSession, router, setScanSessionBootstrapping]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        resetCurrentScanOperation('review_hardware_back');
        return true;
      });
      return () => subscription.remove();
    }, [resetCurrentScanOperation]),
  );

  useEffect(() => {
    if (!isFocused) return;

    if (!scanId) {
      console.info('[SCANNER_REVIEW_MISSING_SCAN_ID]', { focused: isFocused });
      router.replace('/dashboard/scanner' as Href);
      return;
    }

    // While the analysis is still running behind this screen the data is
    // legitimately empty. Bouncing back to processing here would remount it
    // and submit the same scan a second time, spending a second credit.
    if (!Object.keys(structuredData).length && !isDemoScanMode() && !analysisPending) {
      console.info('[SCANNER_REVIEW_MISSING_STRUCTURED_DATA]', { scanId });
      router.replace('/dashboard/scanner/processing' as Href);
    }
  }, [scanId, structuredData, router, isFocused, analysisPending]);

  // The structured-data mirror feeds the pricing payload and the wishlist,
  // but rebuilding it on every keystroke doubled the store writes per
  // character and re-rendered the whole card twice each time — enough for a
  // controlled field to be reset by a stale value and drop the digit just
  // typed. scanData now updates at once so the field stays live; the mirror
  // follows a beat later, and is flushed before anything reads it.
  const structuredSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncStructuredNow = useCallback(() => {
    const { scanData: latest, structuredData: existing } = useScannerStore.getState();
    setStructuredData(scanItemToStructuredData(latest, existing));
  }, [setStructuredData]);

  const flushStructuredSync = useCallback(() => {
    if (!structuredSyncTimer.current) return;
    clearTimeout(structuredSyncTimer.current);
    structuredSyncTimer.current = null;
    syncStructuredNow();
  }, [syncStructuredNow]);

  useEffect(() => () => flushStructuredSync(), [flushStructuredSync]);

  const handleFieldChange = useCallback(
    (field: keyof ScanItemData, value: ScanItemData[keyof ScanItemData]) => {
      if (field === 'customPurityPercent' && !canEditPurityPercent) {
        return;
      }
      const currentState = useScannerStore.getState();
      if (currentState.scanData[field] === value) {
        return;
      }

      updateScanData({ [field]: value });

      if (field === 'calculationRate') {
        // A toggle, not typing: mirror and re-price immediately.
        flushStructuredSync();
        syncStructuredNow();
        bumpMrpRefresh();
        return;
      }

      if (structuredSyncTimer.current) clearTimeout(structuredSyncTimer.current);
      structuredSyncTimer.current = setTimeout(() => {
        structuredSyncTimer.current = null;
        syncStructuredNow();
      }, STRUCTURED_SYNC_MS);
    },
    [updateScanData, bumpMrpRefresh, canEditPurityPercent, flushStructuredSync, syncStructuredNow],
  );

  useEffect(() => {
    if (!canEditPurityPercent && scanData.customPurityPercent.trim()) {
      handleFieldChange('customPurityPercent', '');
    }
  }, [canEditPurityPercent, scanData.customPurityPercent, handleFieldChange]);

  useEffect(() => {
    if (calculationRateAccess === 'both') return;
    const enforced = calculationRateAccess === 'cash' ? 'cash' : 'rtgs';
    if (scanData.calculationRate !== enforced) {
      handleFieldChange('calculationRate', enforced);
    }
  }, [calculationRateAccess, scanData.calculationRate, handleFieldChange]);

  const handleStoneEntriesChange = useCallback(
    (diamonds: StoneEntry[], colorstones: StoneEntry[]) => {
      // Reads the mirror, so any pending field edit must land in it first.
      flushStructuredSync();
      const currentScanData = useScannerStore.getState().scanData;
      const currentStructuredData = useScannerStore.getState().structuredData;
      const stoneFields = applyStoneEntriesToScanData(currentScanData, diamonds, colorstones);
      const updatedScanData = { ...currentScanData, ...stoneFields };
      const nextStructuredData = stoneEntriesToStructuredData(
        currentStructuredData,
        diamonds,
        colorstones,
      );

      const scanDataAlreadyMatches = Object.entries(stoneFields).every(
        ([field, value]) => currentScanData[field as keyof ScanItemData] === value,
      );

      if (scanDataAlreadyMatches && JSON.stringify(nextStructuredData) === JSON.stringify(currentStructuredData)) {
        return;
      }

      updateScanData(stoneFields);
      setStructuredData(scanItemToStructuredData(updatedScanData, nextStructuredData));
    },
    [setStructuredData, updateScanData],
  );


  // Straight back to the camera — no confirmation. This matches the header
  // back chevron and the hardware back, which have always reset without asking.
  const handleReScan = useCallback(() => {
    resetCurrentScanOperation('review_rescan');
  }, [resetCurrentScanOperation]);

  const handleGenerateInvoice = () => {
    flushStructuredSync();
    router.push('/dashboard/scanner/invoice-preview' as Href);
  };

  const handleAddToWishlist = async () => {
    if (addingToWishlist || hasAddedToWishlist) return;
    flushStructuredSync();

    setAddingToWishlist(true);
    try {
      const item = buildWishlistItem({
        scanData,
        structuredData,
        selectedType,
        diamonds,
        colorstones,
        pricing: livePricing,
        scanTimestamp: new Date().toISOString(),
      });
      await addWishlistItem(item);
      setHasAddedToWishlist(true);
      // The button switches to "Item Added", so a popup adds a tap for nothing.
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to add item. Please try again.';
      Alert.alert('Wishlist Error', message);
    } finally {
      setAddingToWishlist(false);
    }
  };

  return (
    <View className="flex-1 bg-surface-muted">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Same keyboard handling as the login pages: the card shrinks above
            the keyboard and the scroll view brings the focused field into view. */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {/* Mockup .rev-card-wrap — 52px top (44 status + 8) / 16 sides / 96 bottom (nav + gap). */}
        <View
          className="flex-1"
          style={{
            paddingTop: 8,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 76,
          }}
        >
          <ReviewScannedResultsModal
            scanData={scanData}
            structuredData={structuredData}
            jewelleryType={selectedType}
            pricing={livePricing}
            onFieldChange={handleFieldChange}
            onStoneEntriesChange={handleStoneEntriesChange}
            // The card decides on mount whether to trust the scanned net weight
            // or compute one; remount it once the real data is in.
            key={analysisPending ? 'pending' : 'ready'}
            analysisPending={analysisPending}
            onReScan={handleReScan}
            onGenerateInvoice={handleGenerateInvoice}
            onAddToWishlist={handleAddToWishlist}
            onBack={() => resetCurrentScanOperation('review_back')}
            addingToWishlist={addingToWishlist}
            hasAddedToWishlist={hasAddedToWishlist}
            canEditPurityPercent={canEditPurityPercent}
            calculationRateAccess={calculationRateAccess}
          />
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <BottomNav activeRoute="scanner" scanButtonVariant="gold" />
    </View>
  );
}
