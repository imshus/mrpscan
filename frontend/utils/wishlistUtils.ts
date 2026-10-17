import type { JewelleryType, ScanItemData, StoneEntry, StructuredScanData } from '@/types/scanner';
import type { WishlistItem, WishlistItemSnapshot } from '@/types/wishlist';
import type { AddWishlistPayload } from '@/utils/wishlistApi';
import {
  buildStoneAmountRow,
  computeFinalTabPricing,
  computeGoldAmountWithPurityOverride,
  type FinalTabPricingResult,
  withStoneRows,
} from '@/utils/scanPriceCalculation';
import {
  buildDisplayStoneBlocks,
  parseStoneArraysFromStructuredData,
} from '@/utils/stoneSequenceUtils';
import { resolveScannedKarat } from '@/utils/formulaUtils';
import { roundHalfUp } from '@/utils/moneyMath';

/** Unique ID for each wishlist addition so variants of the same tag can be saved. */
function generateWishlistId(tagCode: string): string {
  const hashStr = tagCode.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const uniqueId = Math.random().toString(36).substring(2, 9);
  return `wl-${hashStr}-${Date.now()}-${uniqueId}`;
}

export function buildTagCode(selectedType: JewelleryType, sku?: string): string {
  const trimmed = sku?.trim();
  if (trimmed) return trimmed.toUpperCase();

  const prefix = selectedType === 'Diamond' ? 'DIA' : 'GOL';
  const year = new Date().getFullYear();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-RP-${year}-${suffix}`;
}

export function buildWishlistTitle(selectedType: JewelleryType): string {
  return selectedType === 'Diamond' ? 'Diamond' : 'Gold';
}

export function formatWishlistPriceBadge(
  _selectedType: JewelleryType,
  pricing: FinalTabPricingResult,
): string {
  // Always show the total MRP regardless of jewellery type, rounded as the
  // card rounds it (half-up on the exact figure).
  const amount = roundHalfUp(pricing.ultimateMrp).toLocaleString('en-IN');
  return `₹ ${amount}`;
}

/** "2h ago", "Yesterday", "3 days ago" — how the wishlist labels age. */
export function formatWishlistAge(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

export function formatWishlistTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  // e.g.  12:52 PM  |  June-12-2026
  const time = date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toUpperCase();
  const month = date.toLocaleString('en-US', { month: 'long' });
  const day   = String(date.getDate()).padStart(2, '0');
  const year  = date.getFullYear();
  return `${time} | ${month}-${day}-${year}`;
}

export function computeWishlistPricing(
  scanData: ScanItemData,
  structuredData: StructuredScanData,
  selectedType: JewelleryType,
): FinalTabPricingResult {
  const { diamonds, colorstones } = parseStoneArraysFromStructuredData(structuredData, scanData);
  const stoneBlocks = buildDisplayStoneBlocks(diamonds, colorstones);
  const stoneRows = stoneBlocks.map((block) =>
    buildStoneAmountRow(
      block.sequenceIndex,
      block.displayTitle,
      block.stoneType,
      block.entry,
    ),
  );

  const selectedKarat = resolveScannedKarat(scanData.karat, scanData.tunch) || '14K';
  const base = computeFinalTabPricing({
    scanData,
    structuredData,
    selectedKarat,
  });

  return withStoneRows(base, stoneRows);
}

export function buildWishlistSnapshot(input: {
  scanData: ScanItemData;
  structuredData: StructuredScanData;
  selectedType: JewelleryType;
  diamonds: StoneEntry[];
  colorstones: StoneEntry[];
  pricing: FinalTabPricingResult;
  scanId?: string | null;
}): WishlistItemSnapshot {
  const scanId = input.scanId?.trim();
  const selectedKarat = resolveScannedKarat(input.scanData.karat, input.scanData.tunch) || '14K';
  const goldMetrics = computeGoldAmountWithPurityOverride({
    netWtGrams: input.pricing.netWtGrams,
    scanData: input.scanData,
    selectedKarat,
    goldRatePerGram: input.pricing.goldRatePerGram,
  });

  return {
    scanData: { ...input.scanData },
    structuredData: { ...input.structuredData },
    selectedType: input.selectedType,
    diamonds: input.diamonds.map((entry) => ({ ...entry })),
    colorstones: input.colorstones.map((entry) => ({ ...entry })),
    pricing: { ...input.pricing },
    ultimateMrp: input.pricing.ultimateMrp,
    goldBasePrice: goldMetrics.goldAmount,
    goldRatePerGram: input.pricing.goldRatePerGram,
    pureWtGrams: goldMetrics.pureWtGrams,
    effectivePurityPercent: goldMetrics.purityPercent,
    usedLaborPurityOverride: goldMetrics.usedLaborOverride,
    ...(scanId ? { scanId } : {}),
  };
}

export function buildWishlistItem(input: {
  scanData: ScanItemData;
  structuredData: StructuredScanData;
  selectedType: JewelleryType;
  diamonds: StoneEntry[];
  colorstones: StoneEntry[];
  pricing?: FinalTabPricingResult;
  /** ISO string of when the scan was originally created */
  scanTimestamp?: string;
  /** The scan being saved (the scanner's scanId), kept in the snapshot. */
  scanId?: string | null;
}): WishlistItem {
  const pricing =
    input.pricing ??
    computeWishlistPricing(input.scanData, input.structuredData, input.selectedType);

  const snapshot = buildWishlistSnapshot({ ...input, pricing });
  const now = new Date().toISOString();
  const tagCode = buildTagCode(input.selectedType, input.scanData.sku);

  return {
    id: generateWishlistId(tagCode),   // deterministic — same tag = same id
    title: buildWishlistTitle(input.selectedType),
    tagCode,
    priceBadge: formatWishlistPriceBadge(input.selectedType, pricing),
    calculationRate: input.scanData.calculationRate,
    totalMrp: roundHalfUp(pricing.ultimateMrp),
    addedAt: now,
    scanTimestamp: input.scanTimestamp ?? now,
    snapshot,
  };
}

/**
 * POST /wishlist's body for an item: the item as it is saved, and the scan
 * and catalogue name its Wishlist history line is filed under. A name is
 * sent only when the tag matched a catalogue item; without one the server
 * names the line "<karat> <type>" ("22K Gold").
 */
export function wishlistAddPayload(item: WishlistItem): AddWishlistPayload {
  const scanId = item.snapshot?.scanId?.trim();
  const itemName = item.snapshot?.scanData?.itemName?.trim();
  return {
    itemId: item.id,
    title: item.title,
    tagCode: item.tagCode,
    totalMrp: item.totalMrp,
    priceBadge: item.priceBadge,
    calculationRate: item.calculationRate,
    scanTimestamp: item.scanTimestamp,
    snapshot: item.snapshot,
    ...(scanId ? { scanId } : {}),
    ...(itemName ? { itemName } : {}),
  };
}
