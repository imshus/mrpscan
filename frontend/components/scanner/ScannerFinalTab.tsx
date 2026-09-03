import { memo, useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import {
  getLaborValuesFromScanData,
  LaborSection,
  type LaborSectionValues,
} from '@/components/scanner/LaborSection';
import { LabourChargeResultSection } from '@/components/scanner/LabourChargeResultSection';
import { MrpBreakdownCard } from '@/components/scanner/MrpBreakdownCard';
import { FinNote, FinRow, MetalTile } from '@/components/scanner/ReviewCardKit';
import { RawMaterialGoldSectionInteractive } from '@/components/scanner/RawMaterialGoldSection';
import { RawMaterialSection } from '@/components/scanner/RawMaterialSection';
import { StoneTypeRowCard } from '@/components/scanner/StoneTypeRowCard';
import { StoneTypeSequence } from '@/components/scanner/StoneTypeResultSection';
import type { FinalTabPricingResult } from '@/utils/scanPriceCalculation';
import type { GoldRate, TaxSettings } from '@/types/rates';
import type {
  JewelleryType,
  OtherChargeItem,
  ScanItemData,
  StoneEntry,
  StructuredScanData,
} from '@/types/scanner';
import { resolveScannedKarat } from '@/utils/formulaUtils';
import { formatIndianCurrency } from '@/utils/scanPriceCalculation';
import { OtherChargesSection } from '@/components/scanner/OtherChargesSection';

interface ScannerFinalTabProps {
  scanData: ScanItemData;
  structuredData?: StructuredScanData;
  diamonds: StoneEntry[];
  colorstones: StoneEntry[];
  jewelleryType: JewelleryType;
  pricing: FinalTabPricingResult;
  goldRates?: GoldRate[];
  goldTaxSettings?: TaxSettings;
  mcxLiveRate?: number;
  diamondShapeOptions?: { value: string; label?: string }[];
  /** Reader confidence per scanned field ("grossWeight", "diamonds.0.weight"). */
  fieldConfidence?: Record<string, number>;
  editable?: boolean;
  canEditPurityPercent?: boolean;
  onFieldChange?: (field: keyof ScanItemData, value: ScanItemData[keyof ScanItemData]) => void;
  onStoneEntryChange?: (
    stoneType: 'diamond' | 'colorstone',
    sourceIndex: number,
    values: Partial<StoneEntry>,
  ) => void;
  onRateErrorChange?: (sequenceIndex: number, hasError: boolean) => void;
  showLabourValidation?: boolean;
  gstNote?: string;
  calculationRateAccess?: 'rtgs' | 'cash' | 'both';
  clubDiamonds?: boolean;
  clubColorstones?: boolean;
  onToggleClubDiamonds?: (enabled: boolean) => void;
  onToggleClubColorstones?: (enabled: boolean) => void;
}

/** Below this reader confidence a scanned field is marked for the user to check. */
const ATTENTION_BELOW = 80;

export const ScannerFinalTab = memo(function ScannerFinalTab({
  scanData,
  structuredData,
  diamonds,
  colorstones,
  jewelleryType,
  pricing,
  goldRates,
  goldTaxSettings,
  mcxLiveRate,
  diamondShapeOptions,
  fieldConfidence,
  editable = false,
  canEditPurityPercent = true,
  onFieldChange,
  onStoneEntryChange,
  onRateErrorChange,
  showLabourValidation = false,
  gstNote = 'MRP = Gold + Stones + Labour + Other Charges (server verified)',
  calculationRateAccess = 'both',
  clubDiamonds = false,
  clubColorstones = false,
  onToggleClubDiamonds,
  onToggleClubColorstones,
}: ScannerFinalTabProps) {
  // Derived, not state. The card mounts before the analysis lands and no
  // longer remounts on the result, so a mount-time copy of the karat kept
  // showing 14K after the tag's karat had arrived, while the price (which
  // reads the store) was already using the scanned one.
  const selectedKarat = resolveScannedKarat(scanData.karat, scanData.tunch) || '14K';

  // Intentionally left without combined blocks; render by type for clubbing.

  const diamondBlocks = useMemo(
    () => diamonds.map((entry, index) => ({ entry, index })),
    [diamonds],
  );
  const colorstoneBlocks = useMemo(
    () => colorstones.map((entry, index) => ({ entry, index })),
    [colorstones],
  );

  // Fields the reader was not sure of carry a "check" mark until the user
  // has been through them (an edit clears the mark). Clubbed rows are
  // computed totals and carry none.
  const needsCheck = useCallback(
    (key: string) => {
      const confidence = fieldConfidence?.[key];
      return typeof confidence === 'number' && confidence < ATTENTION_BELOW;
    },
    [fieldConfidence],
  );
  const rawMaterialAttention = useMemo(
    () => ({
      grossWt: needsCheck('grossWeight'),
      netWt: needsCheck('netWeight'),
      karat: needsCheck('karat'),
    }),
    [needsCheck],
  );
  const stoneAttention = useCallback(
    (group: 'diamonds' | 'colorstones', index: number) => ({
      shape: needsCheck(`${group}.${index}.shape`),
      packetCode: needsCheck(`${group}.${index}.packetCode`),
      color: needsCheck(`${group}.${index}.color`),
      clarity: needsCheck(`${group}.${index}.clarity`),
      weight: needsCheck(`${group}.${index}.weight`),
      rate: needsCheck(`${group}.${index}.rate`),
      pieces: needsCheck(`${group}.${index}.pieces`),
    }),
    [needsCheck],
  );
  const diamondAttention = useMemo(
    () => diamondBlocks.map((block) => (clubDiamonds ? undefined : stoneAttention('diamonds', block.index))),
    [diamondBlocks, clubDiamonds, stoneAttention],
  );
  const colorstoneAttention = useMemo(
    () =>
      colorstoneBlocks.map((block) =>
        clubColorstones ? undefined : stoneAttention('colorstones', block.index),
      ),
    [colorstoneBlocks, clubColorstones, stoneAttention],
  );

  const handleKaratChange = useCallback(
    (karat: string) => {
      // The store write re-renders this tab with the new karat.
      onFieldChange?.('karat', karat);
      onFieldChange?.('customPurityPercent', '');
    },
    [onFieldChange],
  );

  // Every prop below that used to be built inline is memoized on exactly the
  // scanData fields the child reads, so the memoized sections only re-render
  // when one of their own values moves — not on every keystroke elsewhere.
  const rawMaterialScanData = useMemo(
    () => ({
      grossWt: scanData.grossWt,
      netWt: scanData.netWt,
      karat: selectedKarat,
      tunch: scanData.tunch,
      customPurityPercent: scanData.customPurityPercent,
      labourPurityPercent: scanData.labourPurityPercent,
    }),
    [
      scanData.grossWt,
      scanData.netWt,
      selectedKarat,
      scanData.tunch,
      scanData.customPurityPercent,
      scanData.labourPurityPercent,
    ],
  );

  const handleRawMaterialFieldChange = useCallback(
    (field: keyof ScanItemData, value: ScanItemData[keyof ScanItemData]) => {
      if (field === 'karat') {
        handleKaratChange(String(value));
        return;
      }
      onFieldChange?.(field, value);
    },
    [handleKaratChange, onFieldChange],
  );

  const laborValues = useMemo(
    () =>
      getLaborValuesFromScanData({
        labourPurityPercent: scanData.labourPurityPercent,
        labourChargeAmount: scanData.labourChargeAmount,
        labourChargeUnit: scanData.labourChargeUnit,
        labourWeightBasis: scanData.labourWeightBasis,
      }),
    [
      scanData.labourPurityPercent,
      scanData.labourChargeAmount,
      scanData.labourChargeUnit,
      scanData.labourWeightBasis,
    ],
  );

  const handleLaborChange = useCallback(
    (values: Partial<LaborSectionValues>) => {
      if (values.labourPurityPercent !== undefined) {
        onFieldChange?.('labourPurityPercent', values.labourPurityPercent);
      }
      if (values.labourChargeAmount !== undefined) {
        onFieldChange?.('labourChargeAmount', values.labourChargeAmount);
      }
      if (values.labourChargeUnit !== undefined) {
        onFieldChange?.('labourChargeUnit', values.labourChargeUnit);
      }
      if (values.labourWeightBasis !== undefined) {
        onFieldChange?.('labourWeightBasis', values.labourWeightBasis);
      }
    },
    [onFieldChange],
  );

  const handleOtherChargesChange = useCallback(
    (items: OtherChargeItem[]) => {
      const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
      onFieldChange?.('otherChargesItems', items);
      onFieldChange?.('otherChargesAmount', total ? String(total) : '');
    },
    [onFieldChange],
  );

  return (
    <View>
      {editable ? (
        <RawMaterialSection
          scanData={rawMaterialScanData}
          goldRates={goldRates}
          goldTaxSettings={goldTaxSettings}
          mcxLiveRate={mcxLiveRate}
          backendGoldAmount={pricing.goldBasePrice}
          calculationMode={scanData.calculationRate}
          calculationRateAccess={calculationRateAccess}
          editable
          canEditPurityPercent={canEditPurityPercent}
          attention={rawMaterialAttention}
          onFieldChange={handleRawMaterialFieldChange}
        />
      ) : (
        <RawMaterialGoldSectionInteractive
          badge="Gold"
          pricing={pricing}
        />
      )}

      {editable ? (
        <>
          {diamonds.length > 1 || clubDiamonds ? (
            <View className="mb-3 rounded-[14px] border border-border bg-white px-3.5 py-3">
              <Pressable
                onPress={() => onToggleClubDiamonds?.(!clubDiamonds)}
                className="flex-row items-center gap-2"
              >
                <View
                  className={`h-4 w-4 items-center justify-center rounded border ${
                    clubDiamonds ? 'border-primary bg-primary' : 'border-border bg-white'
                  }`}
                >
                  {clubDiamonds ? <Check size={12} color="#FFFFFF" /> : null}
                </View>
                <Text className="text-[12.8px] font-semibold text-text-primary">Club Diamonds</Text>
              </Pressable>
            </View>
          ) : null}

          {/* The entry object itself is the values prop: updateStoneEntryAtIndex
              keeps untouched entries by reference, so sibling rows stay memoized
              while one row is being typed into. */}
          {diamondBlocks.map((block, idx) => (
            <StoneTypeRowCard
              key={`diamond-${block.index}`}
              title={clubDiamonds ? 'Diamond' : `Diamond ${idx + 1}`}
              stoneType="diamond"
              entryIndex={block.index}
              sequenceIndex={idx}
              values={block.entry}
              shapeOptions={diamondShapeOptions}
              attention={diamondAttention[idx]}
              editable
              onChange={onStoneEntryChange}
              onRateErrorChange={onRateErrorChange}
            />
          ))}

          {colorstones.length > 1 || clubColorstones ? (
            <View className="mb-3 rounded-[14px] border border-border bg-white px-3.5 py-3">
              <Pressable
                onPress={() => onToggleClubColorstones?.(!clubColorstones)}
                className="flex-row items-center gap-2"
              >
                <View
                  className={`h-4 w-4 items-center justify-center rounded border ${
                    clubColorstones ? 'border-primary bg-primary' : 'border-border bg-white'
                  }`}
                >
                  {clubColorstones ? <Check size={12} color="#FFFFFF" /> : null}
                </View>
                <Text className="text-[12.8px] font-semibold text-text-primary">Club Colorstones</Text>
              </Pressable>
            </View>
          ) : null}

          {colorstoneBlocks.map((block, idx) => (
            <StoneTypeRowCard
              key={`colorstone-${block.index}`}
              title={clubColorstones ? 'Colorstone' : `Colorstone ${idx + 1}`}
              stoneType="colorstone"
              entryIndex={block.index}
              sequenceIndex={diamondBlocks.length + idx}
              values={block.entry}
              attention={colorstoneAttention[idx]}
              editable
              onChange={onStoneEntryChange}
              onRateErrorChange={onRateErrorChange}
            />
          ))}
        </>
      ) : (
        <StoneTypeSequence rows={pricing.stoneRows} />
      )}

      {editable ? (
        <LaborSection
          values={laborValues}
          onChange={handleLaborChange}
          grossWeightGrams={scanData.grossWt}
          netWeightGrams={scanData.netWt}
          pureWeightDisplay={pricing.pureWtDisplay}
          goldAmountDisplay={pricing.goldBasePriceDisplay}
        />
      ) : (
        <LabourChargeResultSection pricing={pricing} />
      )}

      {editable ? (
        <OtherChargesSection
          charges={scanData.otherChargesItems}
          onChargesChange={handleOtherChargesChange}
        />
      ) : null}

      {!editable && scanData.otherChargesItems?.length ? (
        <MetalTile title="Other Charges" tone="plain">
          {scanData.otherChargesItems.map((charge) => (
            <FinRow
              key={charge.id}
              label={charge.name}
              value={formatIndianCurrency(charge.amount || 0)}
            />
          ))}
          <FinRow label="Other Charges Total" value={pricing.otherChargesDisplay} amount />
        </MetalTile>
      ) : null}

      {!editable ? (
        <MrpBreakdownCard
          goldAmount={pricing.goldBasePriceDisplay}
          diamondAmount={
            pricing.diamondAmount > 0 ? formatIndianCurrency(pricing.diamondAmount) : undefined
          }
          colorstoneAmount={
            pricing.colorstoneAmount > 0
              ? formatIndianCurrency(pricing.colorstoneAmount)
              : undefined
          }
          labourAmount={pricing.labourDisplay}
          otherChargesTotal={
            pricing.otherChargesAmount > 0 ? pricing.otherChargesDisplay : undefined
          }
          ultimateMrp={pricing.ultimateMrpDisplay}
        />
      ) : null}

      {!editable ? <FinNote>{gstNote}</FinNote> : null}
    </View>
  );
});
