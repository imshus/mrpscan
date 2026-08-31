import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScannerFinalTab } from '@/components/scanner/ScannerFinalTab';
import { PriceCard } from '@/components/scanner/PriceCard';
import {
  CardHeader,
  FloatingCard,
  PillButton,
} from '@/components/scanner/ReviewCardKit';
import { useScannerStore } from '@/store/scannerStore';
import { RefreshCw } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useFormulaStore } from '@/store/formulaStore';
import type { ScanItemData, StoneEntry, StructuredScanData } from '@/types/scanner';
import { DIAMOND_SHAPE_OPTIONS, type StoneSelectOption } from '@/constants/stoneRateOptions';
import { fetchDiamondRates, fetchGoldRates } from '@/utils/ratesApi';
import type { GoldRate, TaxSettings } from '@/types/rates';
import type { FinalTabPricingResult } from '@/utils/scanPriceCalculation';
import { computeOtherChargesTotal, parseNumericValue } from '@/utils/scanPriceCalculation';
import {
  applyFormula2KaratConstraint,
  computeNetWeightFallback,
  isKaratWhitelisted,
  resolveScannedKarat,
} from '@/utils/formulaUtils';

import {
  parseStoneArraysFromStructuredData,
  resolveStoneEntryArrays,
  sumStoneWeights,
  updateStoneEntryAtIndex,
} from '@/utils/stoneSequenceUtils';

interface ReviewScannedResultsModalProps {
  scanData: ScanItemData;
  structuredData: StructuredScanData;
  jewelleryType: 'Gold' | 'Diamond';
  onFieldChange: (field: keyof ScanItemData, value: ScanItemData[keyof ScanItemData]) => void;
  onStoneEntriesChange: (diamonds: StoneEntry[], colorstones: StoneEntry[]) => void;
  onReScan: () => void;
  onGenerateInvoice: () => void;
  onAddToWishlist: () => void;
  onBack?: () => void;
  pricing: FinalTabPricingResult;
  addingToWishlist?: boolean;
  hasAddedToWishlist?: boolean;
  canEditPurityPercent?: boolean;
  calculationRateAccess?: 'rtgs' | 'cash' | 'both';
}

export function ReviewScannedResultsModal({
  scanData,
  structuredData,
  jewelleryType,
  onFieldChange,
  onStoneEntriesChange,
  onReScan,
  onGenerateInvoice,
  onAddToWishlist,
  onBack,
  pricing,
  addingToWishlist = false,
  hasAddedToWishlist = false,
  canEditPurityPercent = true,
  calculationRateAccess = 'both',
}: ReviewScannedResultsModalProps) {
  const activeFormula = useFormulaStore((s) => s.activeFormula);
  const formula2Rules = useFormulaStore((s) => s.formula2Rules);

  const stoneDataKey = useMemo(
    () => JSON.stringify({
      jewelleryType,
      structuredData: {
        diamonds: structuredData.diamonds ?? '',
        colorstones: structuredData.colorstones ?? '',
        packetCode: structuredData.packetCode ?? '',
      },
      scanData: {
        diamondWeight: scanData.diamondWeight,
        diamondShape: scanData.diamondShape,
        diamondColor: scanData.diamondColor,
        diamondClarity: scanData.diamondClarity,
        diamondQuality: scanData.diamondQuality,
        diamondRate: scanData.diamondRate,
        diamondPieces: scanData.diamondPieces,
        packetCode: scanData.packetCode,
        colorstoneWeight: scanData.colorstoneWeight,
        colorstoneColor: scanData.colorstoneColor,
        colorstoneClarity: scanData.colorstoneClarity,
        colorstoneQuality: scanData.colorstoneQuality,
        colorstoneRate: scanData.colorstoneRate,
      },
    }),
    [
      jewelleryType,
      structuredData.diamonds,
      structuredData.colorstones,
      structuredData.packetCode,
      scanData.diamondWeight,
      scanData.diamondShape,
      scanData.diamondColor,
      scanData.diamondClarity,
      scanData.diamondQuality,
      scanData.diamondRate,
      scanData.diamondPieces,
      scanData.packetCode,
      scanData.colorstoneWeight,
      scanData.colorstoneColor,
      scanData.colorstoneClarity,
      scanData.colorstoneQuality,
      scanData.colorstoneRate,
    ],
  );

  const parsedStones = useMemo(
    () => parseStoneArraysFromStructuredData(structuredData, scanData),
    [stoneDataKey],
  );

  const [diamondEntries, setDiamondEntries] = useState<StoneEntry[]>(parsedStones.diamonds);
  const [colorstoneEntries, setColorstoneEntries] = useState<StoneEntry[]>(
    parsedStones.colorstones,
  );
  const [rateErrors, setRateErrors] = useState<Record<number, boolean>>({});
  const [diamondShapeOptions, setDiamondShapeOptions] = useState<StoneSelectOption[]>([
    { value: '', label: 'None' },
    ...DIAMOND_SHAPE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
  ]);
  const [goldRates, setGoldRates] = useState<GoldRate[]>([]);
  const [goldTaxSettings, setGoldTaxSettings] = useState<TaxSettings | undefined>();
  const [mcxLiveRate, setMcxLiveRate] = useState(0);

  const [karatDropdownMode, setKaratDropdownMode] = useState(false);
  // The Net Wt formula row was removed from the UI; the fallback still applies
  // whenever the scan itself did not provide a net weight.
  const [useNetWtFormula] = useState(!scanData.netWt);

  useEffect(() => {
    const resolved = resolveStoneEntryArrays(
      parsedStones.diamonds,
      parsedStones.colorstones,
      jewelleryType,
    );

    if (
      JSON.stringify(diamondEntries) === JSON.stringify(resolved.diamonds) &&
      JSON.stringify(colorstoneEntries) === JSON.stringify(resolved.colorstones)
    ) {
      return;
    }

    setDiamondEntries(resolved.diamonds);
    setColorstoneEntries(resolved.colorstones);
    setRateErrors({});
  }, [stoneDataKey, jewelleryType, parsedStones, diamondEntries, colorstoneEntries]);

  const buildClubbedEntry = useCallback(
    (stoneType: 'diamond' | 'colorstone', entries: StoneEntry[]): StoneEntry => {
      const totalWeight = entries.reduce((sum, entry) => {
        const parsed = Number.parseFloat(entry.weight.replace(/[^\d.]/g, ''));
        return sum + (Number.isFinite(parsed) ? parsed : 0);
      }, 0);
      const formattedWeight = totalWeight > 0
        ? String(totalWeight.toFixed(3)).replace(/\.?0+$/, '')
        : '';

      if (stoneType === 'diamond') {
        return {
          stoneType,
          weight: formattedWeight,
          shape: '',
          packetCode: '',
          color: '',
          clarity: '',
          quality: '',
          rate: '',
          discountPercent: '0',
          pieces: '',
        };
      }

      return {
        stoneType,
        weight: formattedWeight,
        color: '',
        clarity: '',
        quality: '',
        rate: '',
      };
    },
    [],
  );

  const toggleDiamondClubbing = useCallback(
    (enabled: boolean) => {
      if (diamondEntries.length < 2 && enabled) return;

      if (enabled) {
        onFieldChange('clubbedDiamondsBackup', JSON.stringify(diamondEntries));
        onFieldChange('clubDiamonds', true);
        const clubbed = buildClubbedEntry('diamond', diamondEntries);
        setDiamondEntries([clubbed]);
        onStoneEntriesChange([clubbed], colorstoneEntries);
        return;
      }

      const backup = scanData.clubbedDiamondsBackup;
      const restored = backup ? (JSON.parse(backup) as StoneEntry[]) : diamondEntries;
      onFieldChange('clubDiamonds', false);
      setDiamondEntries(restored);
      onStoneEntriesChange(restored, colorstoneEntries);
    },
    [
      diamondEntries,
      colorstoneEntries,
      onFieldChange,
      onStoneEntriesChange,
      buildClubbedEntry,
      scanData.clubbedDiamondsBackup,
    ],
  );

  const toggleColorstoneClubbing = useCallback(
    (enabled: boolean) => {
      if (colorstoneEntries.length < 2 && enabled) return;

      if (enabled) {
        onFieldChange('clubbedColorstonesBackup', JSON.stringify(colorstoneEntries));
        onFieldChange('clubColorstones', true);
        const clubbed = buildClubbedEntry('colorstone', colorstoneEntries);
        setColorstoneEntries([clubbed]);
        onStoneEntriesChange(diamondEntries, [clubbed]);
        return;
      }

      const backup = scanData.clubbedColorstonesBackup;
      const restored = backup ? (JSON.parse(backup) as StoneEntry[]) : colorstoneEntries;
      onFieldChange('clubColorstones', false);
      setColorstoneEntries(restored);
      onStoneEntriesChange(diamondEntries, restored);
    },
    [
      diamondEntries,
      colorstoneEntries,
      onFieldChange,
      onStoneEntriesChange,
      buildClubbedEntry,
      scanData.clubbedColorstonesBackup,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    fetchGoldRates()
      .then((response) => {
        if (cancelled) return;
        setGoldRates(response.rates ?? []);
        setGoldTaxSettings(response.taxSettings);
        setMcxLiveRate(response.mcxLiveRate ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setGoldRates([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const baseOptions: StoneSelectOption[] = [
      { value: '', label: 'None' },
      ...DIAMOND_SHAPE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    ];

    fetchDiamondRates()
      .then((rates) => {
        if (cancelled) return;
        const baseValues = new Set(baseOptions.map((opt) => opt.value.toLowerCase()));
        const customShapes = rates
          .map((rate) => rate.shape?.trim())
          .filter((shape): shape is string => Boolean(shape))
          .filter((shape) => !baseValues.has(shape.toLowerCase()))
          .map((shape) => ({ value: shape, label: shape }));

        setDiamondShapeOptions([...baseOptions, ...customShapes]);
      })
      .catch(() => {
        if (cancelled) return;
        setDiamondShapeOptions(baseOptions);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const hasRateError = Object.values(rateErrors).some(Boolean);

  useEffect(() => {
    const scannedKarat = resolveScannedKarat(scanData.karat, scanData.tunch) || '14K';
    
    if (activeFormula === 'F2') {
      const { karat, requiresDropdown } = applyFormula2KaratConstraint(scannedKarat, formula2Rules);
      setKaratDropdownMode(requiresDropdown || !scannedKarat);
      if (requiresDropdown) {
        if (!scanData.karat) onFieldChange('karat', scannedKarat);
        return;
      }
      if (karat && karat !== scanData.karat) {
        onFieldChange('karat', karat);
      }
    } else {
      setKaratDropdownMode(!scannedKarat);
      if (!scanData.karat) {
        onFieldChange('karat', scannedKarat);
      }
    }
  }, [activeFormula, formula2Rules, scanData.karat, scanData.tunch, onFieldChange]);

  useEffect(() => {
    if (!useNetWtFormula) return;
    const computed = computeNetWeightFallback(
      scanData.grossWt,
      sumStoneWeights(diamondEntries),
      sumStoneWeights(colorstoneEntries),
    );
    if (computed !== scanData.netWt) {
      onFieldChange('netWt', computed);
    }
  }, [
    useNetWtFormula,
    scanData.grossWt,
    diamondEntries,
    colorstoneEntries,
    scanData.netWt,
    onFieldChange,
  ]);

  const handleStoneEntryChange = useCallback(
    (stoneType: 'diamond' | 'colorstone', sourceIndex: number, values: Partial<StoneEntry>) => {
      if (stoneType === 'diamond') {
        const nextDiamonds = updateStoneEntryAtIndex(diamondEntries, sourceIndex, values);
        setDiamondEntries(nextDiamonds);
        onStoneEntriesChange(nextDiamonds, colorstoneEntries);
        return;
      }

      const nextColorstones = updateStoneEntryAtIndex(colorstoneEntries, sourceIndex, values);
      setColorstoneEntries(nextColorstones);
      onStoneEntriesChange(diamondEntries, nextColorstones);
    },
    [colorstoneEntries, diamondEntries, onStoneEntriesChange],
  );

  const handleStoneRateErrorChange = useCallback((sequenceIndex: number, hasError: boolean) => {
    setRateErrors((prev) => {
      if (prev[sequenceIndex] === hasError) return prev;
      return { ...prev, [sequenceIndex]: hasError };
    });
  }, []);

  return (
    <FloatingCard>
      <CardHeader
        onBack={onBack}
        accessory={
          <Pressable
            onPress={() => useScannerStore.getState().bumpMrpRefresh()}
            hitSlop={8}
            style={styles.refreshBtn}
          >
            <RefreshCw size={14} color={Colors.textPrimary} />
          </Pressable>
        }
      >
        <PriceCard
          label="MRP"
          amount={pricing.ultimateMrpDisplay}
          style={styles.mrpCard}
        />
      </CardHeader>

      {/* Scrollable review content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ScannerFinalTab
          scanData={scanData}
          structuredData={structuredData}
          diamonds={diamondEntries}
          colorstones={colorstoneEntries}
          jewelleryType={jewelleryType}
          pricing={pricing}
          goldRates={goldRates}
          goldTaxSettings={goldTaxSettings}
          mcxLiveRate={mcxLiveRate}
          diamondShapeOptions={diamondShapeOptions}
          editable
          canEditPurityPercent={canEditPurityPercent}
          calculationRateAccess={calculationRateAccess}
          clubDiamonds={scanData.clubDiamonds}
          clubColorstones={scanData.clubColorstones}
          onToggleClubDiamonds={toggleDiamondClubbing}
          onToggleClubColorstones={toggleColorstoneClubbing}
          onFieldChange={onFieldChange}
          onStoneEntryChange={handleStoneEntryChange}
          onRateErrorChange={handleStoneRateErrorChange}
        />

        {hasRateError ? (
          <Text style={styles.rateError}>
            Resolve rate errors before generating invoice.
          </Text>
        ) : null}
        <View style={styles.inlineActions}>
          <PillButton variant="rescan" title="ReScan" onPress={onReScan} />
          <View style={styles.footerRow}>
          <PillButton
            variant="alt"
            title={
              hasAddedToWishlist ? 'Item Added' : addingToWishlist ? 'Adding...' : '♡ Add to Wishlist'
            }
            onPress={onAddToWishlist}
            disabled={hasAddedToWishlist || addingToWishlist}
            style={styles.footerBtn}
          />
          <PillButton
            variant="brand"
            title="Generate Invoice"
            onPress={onGenerateInvoice}
            style={styles.footerBtn}
          />
        </View>
        </View>
      </ScrollView>
    </FloatingCard>
  );
}

const styles = StyleSheet.create({
  mrpCard: {
    marginBottom: 0,
  },
  refreshBtn: {
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnPressed: {
    transform: [{ scale: 0.94 }],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  rateError: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: Colors.dangerText,
  },
  inlineActions: {
    gap: 8,
    marginTop: 16,
    // Extra breathing room underneath lifts the actions clear of the bottom nav.
    marginBottom: 28,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footerBtn: {
    flex: 1,
  },
});
