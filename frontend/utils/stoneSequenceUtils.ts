import type {
  JewelleryType,
  ScanItemData,
  SequentialStoneBlock,
  StoneEntry,
  StoneKind,
  StructuredScanData,
} from '@/types/scanner';
import { buildQuality } from '@/utils/qualityUtils';
import { parseWeightValue } from '@/utils/formulaUtils';
import { caratsOf, findColorstoneRateMatch, stoneWeightUnit } from '@/utils/pricingRules';
import { findMatchingDiamondRate } from '@/utils/stoneRateUtils';
import { resolveWeightAndRate } from '@/utils/stoneWeightRate';
import type { StoneRate } from '@/types/rates';

const STONE_ARRAY_KEYS: Record<StoneKind, 'diamonds' | 'colorstones'> = {
  diamond: 'diamonds',
  colorstone: 'colorstones',
};

const STONE_TYPE_LABELS: Record<StoneKind, string> = {
  diamond: 'Diamond',
  colorstone: 'Colorstone',
};

export function createEmptyStoneEntry(stoneType: StoneKind): StoneEntry {
  return {
    stoneType,
    weight: '',
    color: '',
    clarity: '',
    quality: '',
    rate: '',
    discountPercent: '0',
    pieces: '',
    packetCode: '',
  };
}

function flattenStoneField(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    const value = (raw as { value?: string | number | null }).value;
    return value != null ? String(value).trim() : '';
  }
  return String(raw).trim();
}

function hasStoneData(entry: StoneEntry): boolean {
  return Boolean(
    entry.weight ||
      entry.shape ||
      entry.packetCode ||
      entry.color ||
      entry.clarity ||
      entry.quality ||
      entry.rate ||
      entry.pieces,
  );
}

function shouldRenderStone(entry: StoneEntry): boolean {
  if (entry.stoneType === 'colorstone') {
    return parseWeightValue(entry.weight) > 0;
  }
  return hasStoneData(entry);
}

function normalizeStoneEntry(raw: unknown, stoneType: StoneKind): StoneEntry {
  if (!raw || typeof raw !== 'object') {
    return createEmptyStoneEntry(stoneType);
  }

  const record = raw as Record<string, unknown>;
  const prefix = stoneType === 'diamond' ? 'diamond' : 'colorstone';
  const color = flattenStoneField(record.color ?? record[`${prefix}Color`]);
  const clarity = flattenStoneField(record.clarity ?? record[`${prefix}Clarity`]);
  // A colour stone's own packet code when it has one (the tag-wide code is
  // seeded below), so its rate is looked up by packet first, as the server
  // prices it.
  const packetCode =
    stoneType === 'diamond'
      ? flattenStoneField(record.packetCode ?? record.diamondPacketCode)
      : flattenStoneField(record.packetCode);
  const quality =
    flattenStoneField(record.quality ?? record[`${prefix}Quality`]) ||
    buildQuality(color, clarity);

  // "1.56/550" on the weight line is a weight and a rate, not a weight.
  const printedWeight = flattenStoneField(record.weight ?? record[`${prefix}Weight`]);
  const { weight, rate } = resolveWeightAndRate(
    printedWeight,
    flattenStoneField(record.rate ?? record[`${prefix}Rate`]),
  );
  // The unit the weight was printed in: the reader's, else one written after
  // the figure ("0.40 g"), else carats. A stone kept by this app already
  // carries it.
  const unit = stoneWeightUnit(printedWeight, record.unit);

  return {
    stoneType,
    weight,
    shape: flattenStoneField(record.shape ?? record.diamondShape),
    packetCode,
    color,
    clarity,
    quality,
    rate,
    discountPercent: flattenStoneField(record.discountPercent ?? record.diamondDiscountPercent) || '0',
    pieces: flattenStoneField(record.pieces ?? record.diamondPieces),
    unit,
  };
}

function parseStoneArray(raw: unknown, stoneType: StoneKind): StoneEntry[] {
  if (raw == null) return [];

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => normalizeStoneEntry(item, stoneType));
}

function stoneEntryFromScanData(scanData: ScanItemData, stoneType: StoneKind): StoneEntry | null {
  if (stoneType === 'diamond') {
    const entry: StoneEntry = {
      stoneType,
      weight: scanData.diamondWeight,
      shape: scanData.diamondShape,
      packetCode: scanData.packetCode,
      color: scanData.diamondColor,
      clarity: scanData.diamondClarity,
      quality:
        scanData.diamondQuality ||
        buildQuality(scanData.diamondColor, scanData.diamondClarity),
      rate: scanData.diamondRate,
      discountPercent: '0',
      pieces: scanData.diamondPieces,
    };
    return hasStoneData(entry) ? entry : null;
  }

  const entry: StoneEntry = {
    stoneType,
    weight: scanData.colorstoneWeight,
    color: scanData.colorstoneColor,
    clarity: scanData.colorstoneClarity,
    quality:
      scanData.colorstoneQuality ||
      buildQuality(scanData.colorstoneColor, scanData.colorstoneClarity),
    rate: scanData.colorstoneRate,
  };
  return hasStoneData(entry) ? entry : null;
}

export function parseStoneArraysFromStructuredData(
  data: StructuredScanData | Record<string, unknown>,
  scanData?: Partial<ScanItemData>,
): { diamonds: StoneEntry[]; colorstones: StoneEntry[] } {
  const record = data as Record<string, unknown>;
  let diamonds = parseStoneArray(record.diamonds, 'diamond');
  let colorstones = parseStoneArray(record.colorstones, 'colorstone');

  // A tag-wide packet code seeds the rows only while none of them carries one
  // of its own. Filling in every empty row instead put the scanned code back
  // the moment the user cleared it, and copied one row's code onto another.
  const globalPacketCode = typeof record.packetCode === 'string' ? record.packetCode.trim() : '';
  if (globalPacketCode && diamonds.length > 0 && diamonds.every((entry) => !entry.packetCode)) {
    diamonds = diamonds.map((entry) => ({ ...entry, packetCode: globalPacketCode }));
  }
  // Colour stones the same way: the tag's packet code names their rate row
  // too (the server's findColorstoneRateMatch), and the reader gives a
  // colour stone no packet code of its own.
  if (globalPacketCode && colorstones.length > 0 && colorstones.every((entry) => !entry.packetCode)) {
    colorstones = colorstones.map((entry) => ({ ...entry, packetCode: globalPacketCode }));
  }

  if (diamonds.length === 0 && scanData) {
    const fallback = stoneEntryFromScanData(scanData as ScanItemData, 'diamond');
    if (fallback) diamonds = [fallback];
  }

  if (colorstones.length === 0 && scanData) {
    const fallback = stoneEntryFromScanData(scanData as ScanItemData, 'colorstone');
    if (fallback) colorstones = [fallback];
  }

  return { diamonds, colorstones };
}

/**
 * A fresh reading's stones with the rates the shop's tables give them, as
 * the review card's rows would look them up once open (and as the server
 * prices the reading): a diamond by packet code, else colour, clarity and
 * shape; a colour stone by packet code, else colour and clarity on a row
 * without one (utils/pricingRules findColorstoneRateMatch). The tag-wide
 * packet code stands in for the stones' own while none has one. A stone no
 * row matches keeps its printed rate. Applied before the card's first price,
 * so that price is already the one the rows settle on.
 */
export function applyStoneRateTables(
  data: StructuredScanData,
  diamondRates: readonly StoneRate[] | null | undefined,
  colorstoneRates: readonly StoneRate[] | null | undefined,
): StructuredScanData {
  const record = data as Record<string, unknown>;
  const globalPacketCode = typeof record.packetCode === 'string' ? record.packetCode.trim() : '';
  const result: StructuredScanData = { ...data };
  const groups: Array<['diamonds' | 'colorstones', StoneKind, readonly StoneRate[] | null | undefined]> = [
    ['diamonds', 'diamond', diamondRates],
    ['colorstones', 'colorstone', colorstoneRates],
  ];
  for (const [key, stoneType, rows] of groups) {
    const raw = record[key];
    if (!rows?.length || typeof raw !== 'string') continue;
    let stones: unknown;
    try {
      stones = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(stones)) continue;
    const ownCode = (stone: Record<string, unknown>) =>
      flattenStoneField(stone.packetCode ?? (stoneType === 'diamond' ? stone.diamondPacketCode : undefined));
    const seedGlobal = Boolean(globalPacketCode) &&
      stones.every((stone) => !stone || typeof stone !== 'object' || !ownCode(stone as Record<string, unknown>));
    let changed = false;
    const priced = stones.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const stone = item as Record<string, unknown>;
      const packetCode = ownCode(stone) || (seedGlobal ? globalPacketCode : '');
      const color = flattenStoneField(stone.color);
      const clarity = flattenStoneField(stone.clarity);
      const match =
        stoneType === 'diamond'
          ? findMatchingDiamondRate([...rows], color, clarity, flattenStoneField(stone.shape), packetCode)
          : findColorstoneRateMatch(rows, { packetCode, color, clarity });
      if (!match) return item;
      const rate = String(match.rate);
      if (flattenStoneField(stone.rate) === rate) return item;
      changed = true;
      return { ...stone, rate };
    });
    if (changed) result[key] = JSON.stringify(priced);
  }
  return result;
}

export function resolveStoneEntryArrays(
  diamonds: StoneEntry[],
  colorstones: StoneEntry[],
  jewelleryType: JewelleryType,
): { diamonds: StoneEntry[]; colorstones: StoneEntry[] } {
  const resolvedDiamonds = diamonds.filter(hasStoneData);
  const resolvedColorstones = colorstones.filter(shouldRenderStone);

  if (jewelleryType !== 'Diamond') {
    return { diamonds: resolvedDiamonds, colorstones: resolvedColorstones };
  }

  return { diamonds: resolvedDiamonds, colorstones: resolvedColorstones };
}

/** Display-only stone blocks: only entries with scanner data, no empty placeholders. */
export function buildDisplayStoneBlocks(
  diamonds: StoneEntry[],
  colorstones: StoneEntry[],
): SequentialStoneBlock[] {
  const blocks: SequentialStoneBlock[] = [];
  let sequenceIndex = 0;
  let diamondIndex = 0;
  let colorstoneIndex = 0;

  for (let sourceIndex = 0; sourceIndex < diamonds.length; sourceIndex++) {
    const entry = diamonds[sourceIndex];
    if (!shouldRenderStone(entry)) continue;
    diamondIndex += 1;
    blocks.push({
      sequenceIndex,
      displayTitle: `${STONE_TYPE_LABELS.diamond} ${diamondIndex}`,
      stoneType: 'diamond',
      entry,
      sourceIndex,
    });
    sequenceIndex += 1;
  }

  for (let sourceIndex = 0; sourceIndex < colorstones.length; sourceIndex++) {
    const entry = colorstones[sourceIndex];
    if (!shouldRenderStone(entry)) continue;
    colorstoneIndex += 1;
    blocks.push({
      sequenceIndex,
      displayTitle: `${STONE_TYPE_LABELS.colorstone} ${colorstoneIndex}`,
      stoneType: 'colorstone',
      entry,
      sourceIndex,
    });
    sequenceIndex += 1;
  }

  return blocks;
}

export function buildSequentialStoneBlocks(
  diamonds: StoneEntry[],
  colorstones: StoneEntry[],
  jewelleryType: JewelleryType,
): SequentialStoneBlock[] {
  const { diamonds: resolvedDiamonds, colorstones: resolvedColorstones } = resolveStoneEntryArrays(
    diamonds,
    colorstones,
    jewelleryType,
  );

  const blocks: SequentialStoneBlock[] = [];
  let sequenceIndex = 0;
  let diamondIndex = 0;
  let colorstoneIndex = 0;

  for (let sourceIndex = 0; sourceIndex < resolvedDiamonds.length; sourceIndex++) {
    const entry = resolvedDiamonds[sourceIndex];
    if (!shouldRenderStone(entry)) continue;
    diamondIndex += 1;
    blocks.push({
      sequenceIndex,
      displayTitle: `${STONE_TYPE_LABELS.diamond} ${diamondIndex}`,
      stoneType: 'diamond',
      entry,
      sourceIndex,
    });
    sequenceIndex += 1;
  }

  for (let sourceIndex = 0; sourceIndex < resolvedColorstones.length; sourceIndex++) {
    const entry = resolvedColorstones[sourceIndex];
    if (!shouldRenderStone(entry)) continue;
    colorstoneIndex += 1;
    blocks.push({
      sequenceIndex,
      displayTitle: `${STONE_TYPE_LABELS.colorstone} ${colorstoneIndex}`,
      stoneType: 'colorstone',
      entry,
      sourceIndex,
    });
    sequenceIndex += 1;
  }

  return blocks;
}

/** The stones' weight in carats (a weight printed in grams is 5 ct a gram), for the net weight fallback. */
export function sumStoneWeights(entries: StoneEntry[]): string {
  const total = entries.reduce((sum, entry) => {
    const parsed = Number.parseFloat(entry.weight.replace(/[^\d.]/g, ''));
    return sum + (Number.isFinite(parsed) ? caratsOf(parsed, entry.unit) : 0);
  }, 0);
  if (total <= 0) return '';
  return String(total);
}

export function applyStoneEntriesToScanData(
  scanData: ScanItemData,
  diamonds: StoneEntry[],
  colorstones: StoneEntry[],
): Partial<ScanItemData> {
  const primaryDiamond = diamonds[0] ?? createEmptyStoneEntry('diamond');
  const primaryColorstone = colorstones[0] ?? createEmptyStoneEntry('colorstone');

  return {
    diamondWeight: primaryDiamond.weight,
    diamondShape: primaryDiamond.shape ?? '',
    diamondColor: primaryDiamond.color,
    diamondClarity: primaryDiamond.clarity,
    diamondQuality: primaryDiamond.quality,
    diamondRate: primaryDiamond.rate,
    diamondPieces: primaryDiamond.pieces ?? '',
    packetCode: primaryDiamond.packetCode ?? '',
    colorstoneWeight: primaryColorstone.weight,
    colorstoneColor: primaryColorstone.color,
    colorstoneClarity: primaryColorstone.clarity,
    colorstoneQuality: primaryColorstone.quality,
    colorstoneRate: primaryColorstone.rate,
  };
}

export function stoneEntriesToStructuredData(
  existing: StructuredScanData,
  diamonds: StoneEntry[],
  colorstones: StoneEntry[],
): StructuredScanData {
  const result: StructuredScanData = { ...existing };

  if (diamonds.length > 0) {
    result[STONE_ARRAY_KEYS.diamond] = JSON.stringify(diamonds);
  } else {
    delete result[STONE_ARRAY_KEYS.diamond];
  }

  if (colorstones.length > 0) {
    result[STONE_ARRAY_KEYS.colorstone] = JSON.stringify(colorstones);
  } else {
    delete result[STONE_ARRAY_KEYS.colorstone];
  }

  const flatFields = applyStoneEntriesToScanData(
    {} as ScanItemData,
    diamonds,
    colorstones,
  );

  if (flatFields.diamondWeight) result.diamondWeight = flatFields.diamondWeight;
  if (flatFields.diamondShape) result.diamondShape = flatFields.diamondShape;
  if (flatFields.diamondColor) result.diamondColor = flatFields.diamondColor;
  if (flatFields.diamondClarity) result.diamondClarity = flatFields.diamondClarity;
  if (flatFields.diamondQuality) result.diamondQuality = flatFields.diamondQuality;
  if (flatFields.diamondRate) result.diamondRate = flatFields.diamondRate;
  if (flatFields.diamondPieces) result.diamondPieces = flatFields.diamondPieces;
  // Cleared on every row means cleared on the tag record too, otherwise the
  // scanned code survives here and is seeded back into the rows on the next
  // parse.
  if (flatFields.packetCode) result.packetCode = flatFields.packetCode;
  else delete result.packetCode;

  if (flatFields.colorstoneWeight) result.colorstoneWeight = flatFields.colorstoneWeight;
  if (flatFields.colorstoneColor) result.colorstoneColor = flatFields.colorstoneColor;
  if (flatFields.colorstoneClarity) result.colorstoneClarity = flatFields.colorstoneClarity;
  if (flatFields.colorstoneQuality) result.colorstoneQuality = flatFields.colorstoneQuality;
  if (flatFields.colorstoneRate) result.colorstoneRate = flatFields.colorstoneRate;

  return result;
}

export function updateStoneEntryAtIndex(
  entries: StoneEntry[],
  index: number,
  partial: Partial<StoneEntry>,
): StoneEntry[] {
  return entries.map((entry, entryIndex) =>
    entryIndex === index ? { ...entry, ...partial } : entry,
  );
}
