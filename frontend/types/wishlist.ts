import type { JewelleryType, ScanItemData, StoneEntry, StructuredScanData } from '@/types/scanner';
import type { FinalTabPricingResult } from '@/utils/scanPriceCalculation';

export interface WishlistItemSnapshot {
  scanData: ScanItemData;
  structuredData: StructuredScanData;
  selectedType: JewelleryType;
  diamonds: StoneEntry[];
  colorstones: StoneEntry[];
  pricing: FinalTabPricingResult;
  ultimateMrp: number;
  goldBasePrice: number;
  goldRatePerGram: number;
  pureWtGrams: number;
  effectivePurityPercent: number;
  usedLaborPurityOverride: boolean;
}

export interface WishlistItem {
  id: string;
  title: string;
  tagCode: string;
  /** Formatted total MRP string, e.g. "₹ 1,84,500" */
  priceBadge: string;
  calculationRate?: 'rtgs' | 'cash';
  /** Numeric total MRP for sorting / calculations */
  totalMrp: number;
  /** ISO string – when the item was added to wishlist */
  addedAt: string;
  /** ISO string – when the scan session was originally created */
  scanTimestamp: string;
  snapshot: WishlistItemSnapshot;
}
