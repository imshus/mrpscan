import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ScannerFinalTab } from '@/components/scanner/ScannerFinalTab';
import { PriceCard } from '@/components/scanner/PriceCard';
import {
  CardHeader,
  FloatingCard,
  PillButton,
} from '@/components/scanner/ReviewCardKit';
import { ChevronDown, RefreshCw } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { ItemCodePicker } from '@/components/scanner/ItemCodePicker';
import { useShake } from '@/components/auth/AuthKit';
import { useFormulaStore } from '@/store/formulaStore';
import type { ScanItemData, StoneEntry, StructuredScanData } from '@/types/scanner';

/**
 * Two firm pulses. The single 80ms tap this used to be was felt on one
 * phone and not on the shop's: red boxes with nothing in the hand, which
 * read as "no vibration" for the packet code and the labour rate.
 */
const REFUSAL_BUZZ = [0, 110, 70, 110];
import { resolveItemIdentity } from '@/utils/itemIdentity';
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
  /** The user typed into these fields of a stone row. */
  onStoneFieldEdited?: (stoneType: 'diamond' | 'colorstone', entryIndex: number, fields: string[]) => void;
  /** Reader confidence per scanned field; low ones are marked for a check. */
  fieldConfidence?: Record<string, number>;
  /** The analysis is still running behind this card; values fill in when it lands. */
  analysisPending?: boolean;
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
  onStoneFieldEdited,
  fieldConfidence,
  analysisPending = false,
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
  // whenever the scan itself did not provide a net weight. The card can open
  // before the analysis lands, so the decision is made once, synchronously, on
  // the first render that carries the result: a state-plus-effect version ran
  // one commit late and let the fallback overwrite a net weight the tag had
  // printed (gross minus not-yet-parsed stones, which is just gross).
  const netWtDecisionRef = useRef<boolean | null>(null);
  if (!analysisPending && netWtDecisionRef.current === null) {
    netWtDecisionRef.current = !scanData.netWt;
  }
  const useNetWtFormula = !analysisPending && netWtDecisionRef.current === true;

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
          discountPercent: '',
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

  /**
   * Stones the tag announced but did not spell out.
   *
   * A diamond with no weight or no rate prices at nothing, so the MRP comes
   * out as if the stone were not there — a gold price on a diamond piece.
   * Generate Invoice turns those boxes red instead of billing it. The red is
   * the whole message: a popup would say the same thing over the top of the
   * very fields it is pointing at, and have to be dismissed to reach them.
   */
  const [showMissingStones, setShowMissingStones] = useState(false);
  // Where the review content starts, so a refused Generate can carry the eye
  // to the boxes it just turned red. A buzz alone left the shop looking at
  // the bottom of a long card wondering what had happened.
  const scrollRef = useRef<ScrollView>(null);
  const finalTabY = useRef(0);
  const sectionY = useRef({ stones: 0, labour: 0 });
  const handleSectionLayout = useCallback((section: 'stones' | 'labour', y: number) => {
    sectionY.current[section] = y;
  }, []);
  const [shakeStyle, triggerShake] = useShake();
  const hasIncompleteStones = useMemo(() => {
    // A diamond needs its packet code as well: it is what the stone is looked
    // up by in the shop's own rate table. The labour rate is on the same
    // footing — an empty one prices the making at nothing — so it goes red
    // with the same shake instead of billing a piece with no labour on it.
    const bare = (entry: StoneEntry) => !entry.weight?.trim() || !entry.rate?.trim();
    // Colorstones were in this list and are not any more, at the shop's
    // asking: a colourstone left blank no longer stops an invoice, and its
    // boxes are not marked. Diamonds and the labour rate still are — those
    // price at nothing and would quietly undercharge the piece.
    return (
      diamondEntries.some((entry) => bare(entry) || !entry.packetCode?.trim()) ||
      !scanData.labourChargeAmount?.trim()
    );
  }, [diamondEntries, scanData.labourChargeAmount]);

  // The diamonds come first on the card, so they win when both are empty.
  const firstMissingSection = useMemo<'stones' | 'labour'>(() => {
    const bare = (entry: StoneEntry) => !entry.weight?.trim() || !entry.rate?.trim();
    const diamondsIncomplete = diamondEntries.some(
      (entry) => bare(entry) || !entry.packetCode?.trim(),
    );
    return diamondsIncomplete ? 'stones' : 'labour';
  }, [diamondEntries]);

  // Once everything is filled the red goes away on its own, so a shop that
  // fixes it is not left looking at a warning about nothing.
  useEffect(() => {
    if (!hasIncompleteStones) setShowMissingStones(false);
  }, [hasIncompleteStones]);

  const handleGenerateInvoice = useCallback(() => {
    if (hasIncompleteStones) {
      // Red boxes, one shake and one buzz — the same refusal a wrong MPIN
      // gives, which is a language the hand already knows.
      setShowMissingStones(true);
      triggerShake();
      Vibration.vibrate(REFUSAL_BUZZ);
      // To the section that went red, not to the top of the card — that
      // landed on the gold rows every time, which are not what was marked.
      // A little above it, so its heading is on screen too.
      scrollRef.current?.scrollTo({
        y: Math.max(finalTabY.current + sectionY.current[firstMissingSection] - 16, 0),
        animated: true,
      });
      return;
    }
    onGenerateInvoice();
  }, [hasIncompleteStones, firstMissingSection, onGenerateInvoice, triggerShake]);

  useEffect(() => {
    // Nothing to resolve until the tag's own karat is in: writing the 14K
    // default into the store while the analysis is still running made that
    // default look like a value someone had chosen.
    if (analysisPending) return;
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
  }, [activeFormula, formula2Rules, scanData.karat, scanData.tunch, onFieldChange, analysisPending]);

  // A net weight the user types ends the gross-minus-stones fallback; without
  // this the effect below wrote its own figure back on every keystroke, so the
  // field could not be corrected by hand. The effect keeps calling the raw
  // onFieldChange, so it never disarms itself.
  const handleUserFieldChange = useCallback(
    (field: keyof ScanItemData, value: ScanItemData[keyof ScanItemData]) => {
      if (field === 'netWt') netWtDecisionRef.current = false;
      onFieldChange(field, value);
    },
    [onFieldChange],
  );

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

  // Every stone row receives this one callback, so it must keep its identity
  // while the user types — otherwise React.memo on the rows never hits. The
  // latest entries are read from refs at call time instead of being closed
  // over, and the ref is advanced immediately so back-to-back edits (a typed
  // digit followed by a fetched rate) compose instead of clobbering each other.
  const diamondEntriesRef = useRef(diamondEntries);
  const colorstoneEntriesRef = useRef(colorstoneEntries);
  useEffect(() => {
    diamondEntriesRef.current = diamondEntries;
  }, [diamondEntries]);
  useEffect(() => {
    colorstoneEntriesRef.current = colorstoneEntries;
  }, [colorstoneEntries]);

  const handleStoneEntryChange = useCallback(
    (
      stoneType: 'diamond' | 'colorstone',
      sourceIndex: number,
      values: Partial<StoneEntry>,
      fromUser = true,
    ) => {
      if (fromUser) onStoneFieldEdited?.(stoneType, sourceIndex, Object.keys(values));
      if (stoneType === 'diamond') {
        const nextDiamonds = updateStoneEntryAtIndex(
          diamondEntriesRef.current,
          sourceIndex,
          values,
        );
        diamondEntriesRef.current = nextDiamonds;
        setDiamondEntries(nextDiamonds);
        onStoneEntriesChange(nextDiamonds, colorstoneEntriesRef.current);
        return;
      }

      const nextColorstones = updateStoneEntryAtIndex(
        colorstoneEntriesRef.current,
        sourceIndex,
        values,
      );
      colorstoneEntriesRef.current = nextColorstones;
      setColorstoneEntries(nextColorstones);
      onStoneEntriesChange(diamondEntriesRef.current, nextColorstones);
    },
    [onStoneEntriesChange, onStoneFieldEdited],
  );

  const handleStoneRateErrorChange = useCallback((sequenceIndex: number, hasError: boolean) => {
    setRateErrors((prev) => {
      if (prev[sequenceIndex] === hasError) return prev;
      return { ...prev, [sequenceIndex]: hasError };
    });
  }, []);

  const itemIdentity = resolveItemIdentity(scanData);
  const [codePickerOpen, setCodePickerOpen] = useState(false);

  return (
    <FloatingCard>
      <CardHeader
        onBack={onBack}
        accessory={
          <Pressable
            onPress={onReScan}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Rescan"
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

        {/* Mockup .fin-item-row — what was scanned, named and numbered. */}
        <View style={styles.itemRow}>
          <View style={styles.itemTile}>
            <Text style={styles.itemTileLabel}>Item Name</Text>
            <Text style={styles.itemTileValue} numberOfLines={1}>
              {itemIdentity.name}
            </Text>
          </View>
          {/* The code the tag printed; tapping lists every saved item code. */}
          <Pressable
            onPress={() => setCodePickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Choose item code"
            style={styles.itemTile}
          >
            <Text style={styles.itemTileLabel}>Item Code</Text>
            <View style={styles.itemTileValueRow}>
              <Text style={[styles.itemTileValue, styles.itemTileValueGrow]} numberOfLines={1}>
                {itemIdentity.number || '—'}
              </Text>
              <ChevronDown size={14} color={Colors.textMuted} />
            </View>
          </Pressable>
        </View>
        <ItemCodePicker
          visible={codePickerOpen}
          value={scanData.itemCode || scanData.sku}
          onSelect={(item) => {
            // The tag's own number is left as scanned; only the shop's code
            // and the name it carries are set from the catalogue.
            onFieldChange('itemCode', item.code);
            onFieldChange('itemName', item.description);
          }}
          onClose={() => setCodePickerOpen(false)}
        />
      </CardHeader>

      {/* Scrollable review content */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={shakeStyle}
          onLayout={(event) => {
            finalTabY.current = event.nativeEvent.layout.y;
          }}
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
          fieldConfidence={fieldConfidence}
          editable
          canEditPurityPercent={canEditPurityPercent}
          calculationRateAccess={calculationRateAccess}
          clubDiamonds={scanData.clubDiamonds}
          clubColorstones={scanData.clubColorstones}
          highlightMissingStones={showMissingStones}
          onSectionLayout={handleSectionLayout}
          onToggleClubDiamonds={toggleDiamondClubbing}
          onToggleClubColorstones={toggleColorstoneClubbing}
          onFieldChange={handleUserFieldChange}
          onStoneEntryChange={handleStoneEntryChange}
          onRateErrorChange={handleStoneRateErrorChange}
        />
        </Animated.View>

        {hasRateError ? (
          <Text style={styles.rateError}>
            Resolve rate errors before generating invoice.
          </Text>
        ) : null}
        <View style={styles.inlineActions}>
          {/* ReScan and Add to Wishlist share a row; the primary action sits
              underneath at full width so it reads as the main step. */}
          <View style={styles.footerRow}>
            <PillButton
              variant="rescan"
              title="ReScan"
              onPress={onReScan}
              style={styles.footerBtn}
            />
            <PillButton
              variant="alt"
              title={
                hasAddedToWishlist ? 'Item Added' : addingToWishlist ? 'Adding...' : '♡ Add to Wishlist'
              }
              onPress={onAddToWishlist}
              disabled={hasAddedToWishlist || addingToWishlist || analysisPending}
              style={styles.footerBtn}
            />
          </View>
          <PillButton
            variant="brand"
            title="Generate Invoice"
            onPress={handleGenerateInvoice}
            disabled={analysisPending}
            large
            style={styles.primaryAction}
          />
        </View>
      </ScrollView>
    </FloatingCard>
  );
}

const styles = StyleSheet.create({
  mrpCard: {
    marginBottom: 0,
  },
  itemRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  itemTile: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  itemTileLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: Colors.textMuted,
  },
  itemTileValue: { fontSize: 13.5, fontWeight: '800', color: Colors.textPrimary },
  itemTileValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTileValueGrow: { flex: 1, minWidth: 0 },
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
  // Full width and taller than the pair above it, so Generate Invoice reads as
  // the primary step rather than a third equal option.
  primaryAction: {
    width: '100%',
    marginTop: 4,
  },
});
