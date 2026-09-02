import { create } from 'zustand';

import { DEFAULT_SCAN_ITEM } from '@/constants/scannerData';
import { ScanStage } from '@/types/scanner';
import type {
  AbbreviationOption,
  ClarificationField,
  JewelleryType,
  ScanLoadingState,
  ScanItemData,
  ScanMode,
  ScanSide,
  StructuredScanData,
  UnknownField,
} from '@/types/scanner';
import type { FinalTabPricingResult } from '@/utils/scanPriceCalculation';

interface ScannerState {
  selectedType: JewelleryType;
  scanMode: ScanMode;
  scanSide: ScanSide;
  scanId: string | null;
  frontImageUri: string | null;
  backImageUri: string | null;
  structuredData: StructuredScanData;
  unknownFields: UnknownField[];
  clarificationFields: ClarificationField[];
  undetectedAbbreviation: string;
  resolvedAbbreviation: AbbreviationOption;
  scanData: ScanItemData;
  scanSessionBootstrapping: boolean;
  isLoading: boolean;
  error: string | null;
  scanLoading: ScanLoadingState;
  mrpRefreshToken: number;
  /**
   * The pricing the scanner preview screen last displayed.
   *
   * The invoice bills from this rather than asking the server again, so the
   * figures on the bill are the very ones the customer was quoted — not a
   * second answer to the same question.
   */
  previewPricing: FinalTabPricingResult | null;
  setPreviewPricing: (pricing: FinalTabPricingResult | null) => void;
  bumpMrpRefresh: () => void;
  setSelectedType: (type: JewelleryType) => void;
  setScanMode: (mode: ScanMode) => void;
  setScanSide: (side: ScanSide) => void;
  setScanId: (scanId: string | null) => void;
  setFrontImageUri: (uri: string | null) => void;
  setBackImageUri: (uri: string | null) => void;
  setStructuredData: (data: StructuredScanData) => void;
  setUnknownFields: (fields: UnknownField[]) => void;
  setClarificationFields: (fields: ClarificationField[]) => void;
  setResolvedAbbreviation: (abbreviation: AbbreviationOption) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setScanLoading: (payload: Partial<ScanLoadingState>) => void;
  /** True from the moment a scan is submitted until its result is in the store. */
  analysisPending: boolean;
  setAnalysisPending: (value: boolean) => void;
  setScanSessionBootstrapping: (value: boolean) => void;
  resetScanLoading: () => void;
  updateScanData: (data: Partial<ScanItemData>) => void;
  resetScanSession: () => void;
  resetScanData: () => void;
}

const initialSessionState = {
  scanId: null as string | null,
  frontImageUri: null as string | null,
  backImageUri: null as string | null,
  structuredData: {} as StructuredScanData,
  unknownFields: [] as UnknownField[],
  clarificationFields: [] as ClarificationField[],
  isLoading: false,
  error: null as string | null,
  scanLoading: {
    stage: ScanStage.Uploading,
    progress: 0,
    message: 'Uploading Tags...',
  } as ScanLoadingState,
  previewPricing: null as FinalTabPricingResult | null,
  analysisPending: false,
};

export const useScannerStore = create<ScannerState>((set) => ({
  selectedType: 'Diamond',
  scanMode: 'both',
  scanSide: 'front',
  undetectedAbbreviation: 'GRT',
  resolvedAbbreviation: 'Gross Wt',
  scanData: { ...DEFAULT_SCAN_ITEM },
  scanSessionBootstrapping: false,
  ...initialSessionState,
  setSelectedType: (type) =>
    set((state) => ({
      selectedType: type,
      scanData: { ...state.scanData, category: type },
    })),
  setScanMode: (mode) => set({ scanMode: mode }),
  setScanSide: (side) => set({ scanSide: side }),
  setScanId: (scanId) => set({ scanId }),
  setFrontImageUri: (uri) => set({ frontImageUri: uri }),
  setBackImageUri: (uri) => set({ backImageUri: uri }),
  setStructuredData: (data) => set({ structuredData: data }),
  setUnknownFields: (fields) =>
    set({
      unknownFields: fields,
      undetectedAbbreviation: fields[0]?.abbreviation ?? 'GRT',
    }),
  setClarificationFields: (fields) =>
    set({
      clarificationFields: fields,
      unknownFields: fields.map((f) => ({
        abbreviation: f.abbreviation,
        detectedValue: f.detectedValue,
      })),
      undetectedAbbreviation: fields[0]?.abbreviation ?? 'GRT',
    }),
  setResolvedAbbreviation: (abbreviation) => set({ resolvedAbbreviation: abbreviation }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setScanSessionBootstrapping: (value) => set({ scanSessionBootstrapping: value }),
  setScanLoading: (payload) =>
    set((state) => ({
      scanLoading: {
        ...state.scanLoading,
        ...payload,
      },
    })),
  setAnalysisPending: (value) => set({ analysisPending: value }),
  resetScanLoading: () =>
    set({
      scanLoading: {
        stage: ScanStage.Uploading,
        progress: 0,
        message: 'Uploading Tags...',
      },
    }),
  updateScanData: (data) =>
    set((state) => ({
      scanData: { ...state.scanData, ...data },
    })),
  resetScanSession: () =>
    set({
      ...initialSessionState,
      scanSide: 'front',
      undetectedAbbreviation: 'GRT',
      resolvedAbbreviation: 'Gross Wt',
      scanData: { ...DEFAULT_SCAN_ITEM },
    }),
  resetScanData: () =>
    set({
      selectedType: 'Diamond',
      scanMode: 'both',
      scanSide: 'front',
      undetectedAbbreviation: 'GRT',
      resolvedAbbreviation: 'Gross Wt',
      scanData: { ...DEFAULT_SCAN_ITEM },
      ...initialSessionState,
    }),
  mrpRefreshToken: 0,
  setPreviewPricing: (pricing) => set({ previewPricing: pricing }),
  bumpMrpRefresh: () => set((state) => ({ mrpRefreshToken: Date.now() })),
}));
