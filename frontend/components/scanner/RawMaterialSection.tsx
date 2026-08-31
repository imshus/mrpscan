import { useEffect, useMemo, useState } from 'react';

import { useFormulaStore } from '@/store/formulaStore';

import {
  MetalFieldSlot,
  MetalGrid,
  MetalInput,
  MetalTile,
  MetalValueBox,
} from '@/components/scanner/ReviewCardKit';
import { SearchableSelectDropdown } from '@/components/scanner/SearchableSelectDropdown';
import type { SearchableSelectOption } from '@/components/scanner/SearchableSelectDropdown';
import {
  KARAT_DROPDOWN_OPTIONS,
  computePureWeightGrams,
  formatIndianCurrency,
  formatWeightGrams,
} from '@/utils/scanPriceCalculation';
import { resolveMcxChangeValue } from '@/utils/goldRateUtils';
import { parseNumericLabourValue } from '@/utils/labourUtils';
import { resolveScannedKarat, parseWeightValue, normalizeKarat } from '@/utils/formulaUtils';
import type { ScanItemData } from '@/types/scanner';
import type { GoldRate, TaxSettings } from '@/types/rates';

interface RawMaterialSectionProps {
  scanData: Pick<
    ScanItemData,
    'grossWt' | 'netWt' | 'karat' | 'tunch' | 'customPurityPercent' | 'labourPurityPercent'
  >;
  editable?: boolean;
  canEditPurityPercent?: boolean;
  onFieldChange?: (field: keyof ScanItemData, value: ScanItemData[keyof ScanItemData]) => void;
  goldRates?: GoldRate[];
  goldTaxSettings?: TaxSettings;
  mcxLiveRate?: number;
  calculationMode?: 'rtgs' | 'cash';
  calculationRateAccess?: 'rtgs' | 'cash' | 'both';
  backendGoldAmount?: number;
}

function normalizeRateKarat(carat: string): string {
  return carat.replace(/kt/i, 'k').toUpperCase();
}

function sanitizePurityInput(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';

  const [integerPart = '', ...decimalParts] = cleaned.split('.');
  const decimalPart = decimalParts.join('').replace(/\./g, '');
  let next = integerPart;

  if (cleaned.includes('.')) {
    next = `${integerPart}.${decimalPart}`;
  }

  if (next === '.') return '';

  const parsed = Number.parseFloat(next);
  if (!Number.isFinite(parsed)) return next;
  if (parsed > 100) return '100';
  if (parsed < 0) return '';

  return next;
}

export function RawMaterialSection({
  scanData,
  editable = false,
  canEditPurityPercent = true,
  onFieldChange,
  goldRates,
  goldTaxSettings,
  mcxLiveRate = 0,
  calculationMode = 'rtgs',
  calculationRateAccess = 'both',
  backendGoldAmount,
}: RawMaterialSectionProps) {
  const [isPurityEditing, setIsPurityEditing] = useState(false);
  const rateOptions: Array<{ value: 'rtgs' | 'cash'; label: string }> = [
    { value: 'rtgs', label: 'RTGS' },
    { value: 'cash', label: 'Cash' },
  ];
  const fixedRateLabel = calculationRateAccess === 'cash' ? 'Cash Rate' : 'RTGS Rate';
  const activeFormula = useFormulaStore((s) => s.activeFormula);
  const formula2Rules = useFormulaStore((s) => s.formula2Rules);

  const displayedKaratOptions = useMemo<readonly SearchableSelectOption[]>(() => {
    const options =
      activeFormula === 'F2' && formula2Rules.length > 0
        ? KARAT_DROPDOWN_OPTIONS.filter((option) => formula2Rules.includes(option))
        : KARAT_DROPDOWN_OPTIONS;
    return options.map((option) => ({ value: option, label: option }));
  }, [activeFormula, formula2Rules]);

  const resolvedKarat = resolveScannedKarat(scanData.karat, scanData.tunch);
  const normalizedKarat = normalizeKarat(resolvedKarat);
  const defaultPurity = useMemo(() => {
    if (!normalizedKarat) return 0;
    if (normalizedKarat === '24K') return 99.9;
    const match = goldRates?.find(
      (rate) => normalizeRateKarat(rate.carat) === normalizedKarat,
    );
    return match?.purity ?? 0;
  }, [goldRates, normalizedKarat]);

  const [purityDraft, setPurityDraft] = useState('');

  useEffect(() => {
    if (isPurityEditing) return;

    if (scanData.customPurityPercent.trim()) {
      setPurityDraft(scanData.customPurityPercent);
      return;
    }

    if (defaultPurity > 0) {
      setPurityDraft(String(defaultPurity));
      return;
    }

    setPurityDraft('');
  }, [scanData.customPurityPercent, defaultPurity, isPurityEditing]);

  const hasCustomPurity = scanData.customPurityPercent.trim().length > 0;
  const customPurityValue = parseNumericLabourValue(scanData.customPurityPercent) ?? 0;
  const effectivePurity = hasCustomPurity ? customPurityValue : defaultPurity;
  const netWtGrams = parseWeightValue(scanData.netWt);
  const pureWeightGrams = computePureWeightGrams(netWtGrams, effectivePurity);

  const scannerUse = calculationMode ?? 'rtgs';
  const baseFinalRate =
    scannerUse === 'cash' ? goldTaxSettings?.cashFinalRate : goldTaxSettings?.rtgsFinalRate;
  const mcxChangeBy =
    goldTaxSettings?.mcxChangeBy ??
    resolveMcxChangeValue(goldTaxSettings?.mcxChange);
  const mcxFinalRate =
    goldTaxSettings?.mcxFinalRate ??
    (mcxLiveRate ? mcxLiveRate + mcxChangeBy : 0);
  const fallbackBase = mcxFinalRate
    ? mcxFinalRate +
      (scannerUse === 'cash'
        ? goldTaxSettings?.cashChangeBy ?? 0
        : goldTaxSettings?.rtgsChangeBy ?? 0)
    : 0;
  const finalBaseRate = baseFinalRate ?? fallbackBase;
  const currentGoldRate =
    finalBaseRate > 0 && effectivePurity > 0
      ? finalBaseRate * (effectivePurity / 100)
      : 0;
  const localCurrentGoldRateDisplay =
    currentGoldRate > 0 ? `${formatIndianCurrency(currentGoldRate)} /10gm` : '—';
  const localGoldAmount =
    currentGoldRate > 0 && pureWeightGrams > 0
      ? (currentGoldRate / 10) * pureWeightGrams
      : 0;

  // Current Gold Rate field should show selected 24K RTGS/Cash base rate adjusted by purity %.
  // i.e. currentGoldRate = selected24kRatePer10g × (purity / 100)
  const currentGoldRateDisplay = localCurrentGoldRateDisplay;

  const goldAmount =
    typeof backendGoldAmount === 'number' && Number.isFinite(backendGoldAmount)
      ? backendGoldAmount
      : localGoldAmount;

  const handleKaratSelect = (karat: string) => {
    onFieldChange?.('karat', karat);
    onFieldChange?.('customPurityPercent', '');
  };

  const handlePurityEdit = (text: string) => {
    const next = sanitizePurityInput(text);
    setPurityDraft(next);
    // Empty input means no custom override; backend should fallback to karat purity.
    onFieldChange?.('customPurityPercent', next);
  };

  return (
    <MetalTile title="Gold" tone="gold">
      <MetalGrid>
        <MetalInput
          label="Gross Weight"
          value={scanData.grossWt}
          onChangeText={(value) => onFieldChange?.('grossWt', value)}
          editable={editable}
          placeholder="from scanner"
        />
        <MetalInput
          label="Net Weight"
          value={scanData.netWt}
          onChangeText={(value) => onFieldChange?.('netWt', value)}
          editable={editable}
          placeholder="from scanner"
        />
        {editable ? (
          <MetalFieldSlot label="Karat">
            <SearchableSelectDropdown compact
              value={resolvedKarat ?? ''}
              options={displayedKaratOptions ?? []}
              onChange={handleKaratSelect}
              placeholder="Select karat"
              containerClassName="w-full"
            />
          </MetalFieldSlot>
        ) : (
          <MetalValueBox label="Karat" value={resolvedKarat || '—'} />
        )}
        <MetalInput
          label="Purity"
          value={purityDraft}
          onChangeText={handlePurityEdit}
          editable={editable && canEditPurityPercent}
          placeholder="e.g. 91.6"
          keyboardType="decimal-pad"
          onFocus={() => setIsPurityEditing(true)}
          onBlur={() => setIsPurityEditing(false)}
        />
        <MetalValueBox
          label="Pure Weight"
          value={pureWeightGrams > 0 ? formatWeightGrams(pureWeightGrams) : '—'}
        />
        {calculationRateAccess === 'both' ? (
          <MetalFieldSlot label="Gold Rate" fullWidth>
            <SearchableSelectDropdown
              compact
              anchored
              value={calculationMode ?? 'rtgs'}
              options={rateOptions}
              onChange={(value) => onFieldChange?.('calculationRate', value)}
              placeholder="Select gold rate"
              containerClassName="w-full"
            />
          </MetalFieldSlot>
        ) : (
          <MetalValueBox label="Gold Rate" value={fixedRateLabel} fullWidth />
        )}
        <MetalValueBox label="Current Gold Rate" value={currentGoldRateDisplay} />
        <MetalValueBox
          label="Gold Amount"
          value={goldAmount > 0 ? formatIndianCurrency(goldAmount) : '—'}
          amount
        />
      </MetalGrid>
    </MetalTile>
  );
}
