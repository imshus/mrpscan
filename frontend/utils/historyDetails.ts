import {
  formatHistoryPrice,
  formatHistoryWhen,
  groupIndianDigits,
  roundRupees,
} from '@/utils/historyFormat';

/**
 * Settings → History → one tag, as plain logic: a past scan (GET
 * /history/scans/:scanId) or a wishlist entry (GET /history/wishlist/:id)
 * turned into what the read-only details page shows — the MRP, the tiles the
 * review card has (Gold, each diamond and colour stone, Labour, Wastage,
 * Other Charges) and the MRP breakdown.
 *
 * Both answers are read defensively: every field is optional, a reading kept
 * as { value, confidence } is its value, and a field that is missing, blank
 * or zero (a weight, a rate, an amount) is left out rather than shown as
 * "0" or "—" — a row of zeroes reads as "this piece has none" when it means
 * "nobody recorded it". A tile with nothing in it is left out whole.
 *
 * Imports only historyFormat, so node can load it for the tests
 * (utils/__tests__/historyDetails.test.mjs) without the app around it.
 */

export type DetailTone = 'gold' | 'diamond' | 'labour' | 'wastage' | 'plain';

/** One read-only box in a tile's grid. */
export interface DetailField {
  label: string;
  value: string;
  /** The tile's total, in the review card's bold amount style. */
  amount?: boolean;
}

export interface DetailTile {
  key: string;
  title: string;
  tone: DetailTone;
  fields: DetailField[];
}

/** One line of the MRP breakdown. */
export interface DetailLine {
  label: string;
  value: string;
  amount?: boolean;
}

export interface TagDetailView {
  title: string;
  tagCode: string;
  /** "Scanned Today, 8:59 am" / "Added Today, 7:24 am"; '' when the date is unreadable. */
  when: string;
  /** "₹ 82,694", or "—" for a tag that was never priced. */
  mrp: string;
  /** Said under the MRP when there is no price; '' otherwise. */
  note: string;
  tiles: DetailTile[];
  breakdown: DetailLine[];
}

export const UNPRICED_NOTE = 'This tag was read but not priced.';

type Bag = Record<string, unknown>;

function asRecord(value: unknown): Bag | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Bag) : null;
}

function asList(value: unknown): Bag[] {
  return Array.isArray(value) ? value.map((entry) => asRecord(entry) ?? {}) : [];
}

/** A reading kept as { value, confidence } (the analysis's own shape) is its value. */
function unwrap(value: unknown): unknown {
  const record = asRecord(value);
  return record && 'value' in record ? record.value : value;
}

function text(value: unknown): string {
  const raw = unwrap(value);
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return '';
}

/** A number, or a figure written as text ("6.750", "₹ 1,250", "91.6%"); null otherwise. */
function num(value: unknown): number | null {
  const raw = unwrap(value);
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[₹,%\s]/g, '');
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}

function positive(value: unknown): number | null {
  const n = num(value);
  return n !== null && n > 0 ? n : null;
}

/**
 * The first of `keys`, in the first of `bags` that has it, that `format`
 * can show. Bags come in order of trust: what was priced before what was
 * read, since the card may have corrected a reading before pricing it.
 */
function pick<T>(
  bags: readonly (Bag | null | undefined)[],
  keys: readonly string[],
  format: (value: unknown) => T | null,
): T | null {
  for (const bag of bags) {
    if (!bag) continue;
    for (const key of keys) {
      if (!(key in bag)) continue;
      const shown = format(bag[key]);
      if (shown !== null) return shown;
    }
  }
  return null;
}

function nonEmpty(value: unknown): string | null {
  return text(value) || null;
}

/** 6.75 → "6.75", 10 → "10": at most `places` decimals, no trailing zeroes. */
function trimDecimals(n: number, places = 3): string {
  return n.toFixed(places).replace(/\.?0+$/, '');
}

/** "₹58,685" — whole rupees, half-up, as the review card's tiles print money. */
function rupees(n: number | null): string | null {
  if (n === null) return null;
  const rounded = roundRupees(n);
  return `₹${rounded < 0 ? '-' : ''}${groupIndianDigits(String(Math.abs(rounded)))}`;
}

/** A weight in grams ("6.75 g"); text the tag printed some other way is shown as printed. */
function grams(value: unknown): string | null {
  const n = num(value);
  if (n !== null) return n > 0 ? `${trimDecimals(n)} g` : null;
  return nonEmpty(value);
}

/** "91.6%"; a figure past 100 (a fineness, "916") is shown as printed. */
function percentText(value: unknown): string | null {
  const n = num(value);
  if (n !== null) {
    if (n <= 0) return null;
    return n <= 100 ? `${trimDecimals(n, 2)}%` : text(value);
  }
  return nonEmpty(value);
}

/** "22" / "22k" → "22K"; anything else as written. */
function karatText(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const match = /^(\d{1,2}(?:\.\d+)?)\s*k?$/i.exec(raw);
  return match ? `${match[1]}K` : raw;
}

/** "DIAMOND", "Diamond", "colour_stone" → "Diamond", "Colour Stone". */
function typeText(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  return raw.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The Gold tile's rate choice, as the review card names it. */
function rateModeText(value: unknown): string | null {
  const raw = text(value).toLowerCase();
  if (raw === 'rtgs') return 'RTGS';
  if (raw === 'cash') return 'Retail';
  return null;
}

/** Labour's and Wastage's Weight Used, as the review card names it. */
function basisText(value: unknown): string | null {
  const raw = text(value).toLowerCase();
  if (raw === 'gross') return 'Gross wt';
  if (raw === 'net') return 'Net wt';
  return null;
}

/* ==================== the facts both answers are read into ==================== */

interface StoneFacts {
  /** A colour stone's kind as the tag named it ("Ruby"). */
  type: string | null;
  weight: string | null;
  pieces: string | null;
  shape: string | null;
  quality: string | null;
  color: string | null;
  clarity: string | null;
  packetCode: string | null;
  rate: number | null;
  discountPercent: number | null;
  amount: number | null;
}

interface ChargeFacts {
  name: string;
  amount: number;
}

interface TagFacts {
  jewelleryType: string | null;
  serialNumber: string | null;
  itemCode: string | null;
  packetCode: string | null;
  grossWeight: string | null;
  netWeight: string | null;
  netEstimated: boolean;
  karat: string | null;
  purity: string | null;
  pureWeight: string | null;
  rateMode: string | null;
  /** The 24K rate after the piece's purity, a 10 g — the review card's Current Gold Rate. */
  currentGoldRatePer10g: number | null;
  goldAmount: number | null;
  diamonds: StoneFacts[];
  colorstones: StoneFacts[];
  labour: DetailField | null;
  labourBasis: string | null;
  labourAmount: number | null;
  wastageCode: string | null;
  wastagePercent: string | null;
  wastageBasis: string | null;
  wastageWeight: string | null;
  wastageRatePerGram: number | null;
  wastageAmount: number | null;
  otherCharges: ChargeFacts[];
  /** Other charges as the tag printed them, for a tag that was never priced. */
  otherChargesOnTag: string | null;
  otherChargesTotal: number | null;
  diamondAmount: number | null;
  colorstoneAmount: number | null;
  subtotal: number | null;
  finalMrp: number | null;
}

/** "0.25 ct", or "0.5 g" for a stone the tag weighed in grams. */
function stoneWeight(bag: Bag | null | undefined): string | null {
  if (!bag) return null;
  const n = num(bag.weight);
  if (n === null) return nonEmpty(bag.weight);
  if (n <= 0) return null;
  return `${trimDecimals(n)} ${text(bag.unit).toLowerCase() === 'g' ? 'g' : 'ct'}`;
}

/**
 * Stone rows, matched by position: as read off the tag (`read`), as priced
 * (`priced`, the weights and rates the price was worked out on) and the
 * price's own line items (`lines`, carats and amounts).
 */
function stoneFacts(read: Bag[], priced: Bag[], lines: Bag[]): StoneFacts[] {
  const count = Math.max(read.length, priced.length, lines.length);
  const rows: StoneFacts[] = [];
  for (let i = 0; i < count; i += 1) {
    const r = read[i];
    const p = priced[i];
    const l = lines[i];
    const described = [r, p];
    rows.push({
      type: pick(described, ['type'], nonEmpty),
      weight:
        stoneWeight(p) ?? stoneWeight(r) ?? (l ? stoneWeight({ weight: l.weight, unit: 'ct' }) : null),
      pieces: pick(described, ['pieces'], nonEmpty),
      shape: pick(described, ['shape'], nonEmpty),
      quality: pick(described, ['quality'], nonEmpty),
      color: pick(described, ['color', 'colour'], nonEmpty),
      clarity: pick(described, ['clarity'], nonEmpty),
      packetCode: pick(described, ['packetCode'], nonEmpty),
      rate: pick([p, l, r], ['rate'], positive),
      discountPercent: pick([p, l, r], ['discountPercent'], positive),
      amount: pick([l], ['amount'], positive),
    });
  }
  return rows;
}

/** The labour figure, labelled as the review card's Labour tile labels it. */
function labourField(amount: unknown, unit: unknown): DetailField | null {
  const n = positive(amount);
  const unitText = text(unit).toLowerCase();
  if (n === null) {
    const printed = nonEmpty(amount);
    return printed ? { label: 'Labour (on tag)', value: printed } : null;
  }
  if (unitText === 'percent' || text(amount).includes('%')) {
    return { label: 'Labour (% of gold)', value: `${trimDecimals(n, 2)}%` };
  }
  if (unitText === 'per 10 gram') return { label: 'Labour Rate /10g', value: rupees(n) ?? '' };
  return { label: 'Labour Rate', value: rupees(n) ?? '' };
}

function chargeFacts(list: Bag[]): ChargeFacts[] {
  const charges: ChargeFacts[] = [];
  for (const charge of list) {
    const amount = positive(charge.amount);
    if (amount === null) continue;
    charges.push({ name: text(charge.name) || 'Charge', amount });
  }
  return charges;
}

function currentGoldRate(ratePerGram24k: number | null, purity: number | null): number | null {
  return ratePerGram24k !== null && purity !== null && purity <= 100
    ? ratePerGram24k * (purity / 100) * 10
    : null;
}

/* ==================== the view ==================== */

function field(label: string, value: string | null, amount = false): DetailField | null {
  return value ? (amount ? { label, value, amount: true } : { label, value }) : null;
}

function tile(key: string, title: string, tone: DetailTone, fields: (DetailField | null)[]): DetailTile | null {
  const shown = fields.filter((entry): entry is DetailField => entry !== null);
  return shown.length ? { key, title, tone, fields: shown } : null;
}

function stoneTiles(kind: 'diamond' | 'colorstone', stones: StoneFacts[]): (DetailTile | null)[] {
  const diamond = kind === 'diamond';
  return stones.map((stone, index) =>
    tile(`${kind}-${index}`, `${diamond ? 'Diamond' : 'Colorstone'} ${index + 1}`, diamond ? 'diamond' : 'plain', [
      field('Stone', diamond ? null : stone.type),
      field('Weight', stone.weight),
      field('Pieces', stone.pieces),
      field('Shape', stone.shape),
      field('Quality', stone.quality),
      field('Colour', stone.color),
      field('Clarity', stone.clarity),
      field('Packet Code', stone.packetCode),
      field(diamond ? 'Diamond Rate' : 'CS Rate', stone.rate !== null ? `${rupees(stone.rate)} /ct` : null),
      field('Discount', stone.discountPercent !== null ? `${trimDecimals(stone.discountPercent, 2)}%` : null),
      field(diamond ? 'Diamond Amount' : 'CS Amount', rupees(stone.amount), true),
    ]),
  );
}

function buildView(
  header: Pick<TagDetailView, 'title' | 'tagCode' | 'when' | 'note'>,
  facts: TagFacts,
): TagDetailView {
  // Weight Used on its own says nothing about a charge, so it never makes a
  // Labour or Wastage tile by itself.
  const hasLabour = facts.labour !== null || facts.labourAmount !== null;
  const hasWastage =
    facts.wastageCode !== null || facts.wastagePercent !== null || facts.wastageAmount !== null;

  const tiles = [
    tile('tag', 'Tag', 'plain', [
      field('Jewellery Type', facts.jewelleryType),
      field('Serial No.', facts.serialNumber),
      field('Item Code', facts.itemCode),
      field('Packet Code', facts.packetCode),
    ]),
    tile('gold', 'Gold', 'gold', [
      field('Gross Weight', facts.grossWeight),
      field(facts.netEstimated ? 'Net Weight (est.)' : 'Net Weight', facts.netWeight),
      field('Karat', facts.karat),
      field('Purity', facts.purity),
      field('Pure Weight', facts.pureWeight),
      field('Gold Rate', facts.rateMode),
      field(
        'Current Gold Rate',
        facts.currentGoldRatePer10g !== null ? `${rupees(facts.currentGoldRatePer10g)} /10gm` : null,
      ),
      field('Gold Amount', rupees(facts.goldAmount), true),
    ]),
    ...stoneTiles('diamond', facts.diamonds),
    ...stoneTiles('colorstone', facts.colorstones),
    hasLabour
      ? tile('labour', 'Labour Charge', 'labour', [
          facts.labour,
          field('Weight Used', facts.labourBasis),
          field('Labour Amount', rupees(facts.labourAmount), true),
        ])
      : null,
    hasWastage
      ? tile('wastage', 'Wastage', 'wastage', [
          field('Wastage Code', facts.wastageCode),
          field('Wastage %', facts.wastagePercent),
          field('Weight Used', facts.wastageBasis),
          field('Wastage Weight', facts.wastageWeight),
          field('Wastage Rate', facts.wastageRatePerGram !== null ? `${rupees(facts.wastageRatePerGram)} /g` : null),
          field('Wastage Amount', rupees(facts.wastageAmount), true),
        ])
      : null,
    tile('other', 'Other Charges', 'plain', [
      ...facts.otherCharges.map((charge) => field(charge.name, rupees(charge.amount))),
      field('Other Charges (on tag)', facts.otherChargesOnTag),
      field('Other Charges Total', rupees(facts.otherChargesTotal), true),
    ]),
  ].filter((entry): entry is DetailTile => entry !== null);

  // The parts of the price, as the results card's MRP Breakdown lists them:
  // gold and labour whenever priced, the rest only when the piece has them.
  const finalMrp = facts.finalMrp !== null ? roundRupees(facts.finalMrp) : null;
  const subtotal =
    facts.subtotal !== null && roundRupees(facts.subtotal) !== finalMrp ? facts.subtotal : null;
  const breakdown = [
    field('Gold Amount', rupees(facts.goldAmount)),
    field('Diamond Amount', rupees(facts.diamondAmount)),
    field('Colorstone Amount', rupees(facts.colorstoneAmount)),
    field('Labour Amount', rupees(facts.labourAmount)),
    field('Wastage Amount', rupees(facts.wastageAmount)),
    field('Other Charges', rupees(facts.otherChargesTotal)),
    field('Subtotal', rupees(subtotal)),
  ].filter((entry): entry is DetailField => entry !== null);
  if (breakdown.length && finalMrp !== null) {
    breakdown.push({ label: 'Final MRP', value: rupees(finalMrp) ?? '', amount: true });
  }

  return {
    ...header,
    mrp: formatHistoryPrice(facts.finalMrp),
    tiles,
    breakdown,
  };
}

/* ==================== the two answers ==================== */

/**
 * A past scan, GET /history/scans/:scanId → { item } (backend
 * scanHistory.service getScan; utils/__tests__/fixtures/historyServer.json
 * holds real answers):
 *   - `details`, what the analysis read off the tag (readingDetailsOf), each
 *     field the text the reader returned: jewelleryType ("DIAMOND"),
 *     grossWeight, netWeight, karat, purity, serialNumber, itemCode (the
 *     Masters item it matched), packetCode, diamonds / colorstones (weight,
 *     unit, pieces, shape, quality, color, clarity, rate, packetCode; a
 *     colour stone's type too), and labour, wastage and otherCharges as
 *     printed ("LBR 850");
 *   - `pricing` (pricingRecordOf; null until the card asked for a price):
 *     `inputs`, the card's request as read (grossWt, netWt, purityKarat,
 *     calculationMode, diamonds, colorstones, labourChargeAmount / Unit,
 *     labourWeightBasis, wastagePercent, otherCharges, ...), and
 *     `breakdown`, the answer's breakdown with the rate, purity, stone lines
 *     and labour it applied.
 * A line still at status 'read' may carry the price the analysis worked out
 * (`finalMRP`) without `pricing`: it shows that price and the reading.
 */
export function scanDetailView(raw: unknown, now: Date = new Date()): TagDetailView | null {
  const item = asRecord(raw);
  if (!item) return null;
  const details = asRecord(item.details);
  const pricing = asRecord(item.pricing);
  const inputs = asRecord(pricing?.inputs);
  const breakdown = asRecord(pricing?.breakdown);
  const priced = pricing !== null;

  const purity = pick([breakdown], ['effectivePurityPercent'], positive);
  const ratePerGram24k = pick([breakdown], ['goldRateApplied'], positive);
  const adjustedPerGram = pick([breakdown], ['purityAdjustedGoldRatePerGram'], positive);
  const netEstimated = breakdown?.netWeightEstimated === true;
  // The line's own price is the one its list row shows.
  const finalMrp = num(item.finalMRP) ?? pick([breakdown], ['finalMRPRounded', 'finalMRP'], num);

  // Priced: the labour the price charged (the card's figure, else the
  // item's, else the shop's), else the figure the card sent. Only read: the
  // tag's own words ("LBR 850").
  const labour = priced
    ? labourField(breakdown?.labourRate, breakdown?.labourUnit) ??
      labourField(inputs?.labourChargeAmount, inputs?.labourChargeUnit)
    : labourField(details?.labour, null);

  const facts: TagFacts = {
    jewelleryType: pick([details, inputs], ['jewelleryType'], typeText),
    serialNumber: pick([details], ['serialNumber'], nonEmpty),
    itemCode: pick([details], ['itemCode'], nonEmpty),
    packetCode: pick([details], ['packetCode'], nonEmpty),
    // What was priced before what was read: the card may have corrected it.
    grossWeight: pick([inputs], ['grossWt'], grams) ?? pick([details], ['grossWeight'], grams),
    netWeight: netEstimated
      ? pick([breakdown], ['netWeightUsed'], grams)
      : pick([inputs], ['netWt'], grams) ??
        pick([breakdown], ['netWeightUsed'], grams) ??
        pick([details], ['netWeight'], grams),
    netEstimated,
    karat: pick([inputs], ['purityKarat'], karatText) ?? pick([details], ['karat'], karatText),
    purity: purity !== null ? percentText(purity) : pick([details], ['purity'], percentText),
    pureWeight: pick([breakdown], ['pureWeight'], grams),
    rateMode: pick([inputs], ['calculationMode'], rateModeText),
    currentGoldRatePer10g: adjustedPerGram !== null ? adjustedPerGram * 10 : currentGoldRate(ratePerGram24k, purity),
    goldAmount: pick([breakdown], ['goldAmount'], num),
    diamonds: stoneFacts(
      asList(details?.diamonds),
      asList(inputs?.diamonds),
      asList(breakdown?.diamondLineItems),
    ),
    colorstones: stoneFacts(
      asList(details?.colorstones),
      asList(inputs?.colorstones),
      asList(breakdown?.colorstoneLineItems),
    ),
    labour,
    labourBasis: pick([breakdown, inputs], ['labourWeightBasis'], basisText),
    labourAmount: pick([breakdown], ['labourAmount'], num),
    wastageCode: pick([breakdown], ['wastageCode'], nonEmpty),
    wastagePercent: priced
      ? pick([breakdown], ['wastagePercent'], percentText)
      : pick([details], ['wastage'], percentText),
    wastageBasis: pick([breakdown], ['wastageWeightBasis'], basisText),
    wastageWeight: pick([breakdown], ['wastageWeightGrams'], grams),
    wastageRatePerGram: pick([breakdown], ['wastageRatePerGram'], positive),
    wastageAmount: pick([breakdown], ['wastageAmount'], positive),
    // The server keeps the charges' total, not the named list.
    otherCharges: [],
    otherChargesOnTag: priced ? null : pick([details], ['otherCharges'], nonEmpty),
    otherChargesTotal: pick([breakdown], ['otherCharges'], positive),
    diamondAmount: pick([breakdown], ['diamondAmount'], positive),
    colorstoneAmount: pick([breakdown], ['colorstoneAmount'], positive),
    subtotal: pick([breakdown], ['subtotal'], num),
    finalMrp,
  };

  const when = formatHistoryWhen(item.createdAt, now);
  return buildView(
    {
      title: text(item.itemName) || 'Tag scan',
      tagCode: text(item.tagCode),
      when: when ? `Scanned ${when}` : '',
      note: finalMrp === null ? UNPRICED_NOTE : '',
    },
    facts,
  );
}

/**
 * A wishlist entry, GET /history/wishlist/:id → { item }: `snapshot` is the
 * item as the app saved it to the wishlist (utils/wishlistUtils
 * buildWishlistSnapshot: scanData, the stones, and the card's pricing).
 */
export function wishlistDetailView(raw: unknown, now: Date = new Date()): TagDetailView | null {
  const item = asRecord(raw);
  if (!item) return null;
  const snapshot = asRecord(item.snapshot);
  const scan = asRecord(snapshot?.scanData);
  const pricing = asRecord(snapshot?.pricing);
  const structured = asRecord(snapshot?.structuredData);
  const priced = [pricing, snapshot];

  const purity = pick(priced, ['effectivePurityPercent'], positive);
  const ratePerGram24k = pick(priced, ['goldRatePerGram'], positive);
  const stoneRows = asList(pricing?.stoneRows);
  const netEstimated = pricing?.netWeightEstimated === true;

  const facts: TagFacts = {
    jewelleryType: pick([snapshot, scan], ['selectedType', 'category'], typeText),
    serialNumber: pick([scan, structured], ['sku', 'serialNumber'], nonEmpty),
    itemCode: pick([scan], ['itemCode'], nonEmpty),
    packetCode: pick([scan, structured], ['packetCode'], nonEmpty),
    grossWeight: pick([scan], ['grossWt'], grams) ?? pick([pricing], ['grossWtDisplay'], nonEmpty),
    netWeight: netEstimated
      ? pick([pricing], ['netWtGrams'], grams)
      : pick([scan], ['netWt'], grams) ?? pick([pricing], ['netWtGrams'], grams),
    netEstimated,
    karat: pick([pricing, scan], ['selectedKarat', 'karat'], karatText),
    purity:
      purity !== null
        ? percentText(purity)
        : pick([scan], ['customPurityPercent', 'tunch'], percentText),
    pureWeight: pick(priced, ['pureWtGrams'], grams),
    rateMode: pick([scan, item], ['calculationRate'], rateModeText),
    currentGoldRatePer10g: currentGoldRate(ratePerGram24k, purity),
    goldAmount: pick(priced, ['goldBasePrice'], num),
    diamonds: stoneFacts(
      asList(snapshot?.diamonds),
      [],
      stoneRows.filter((row) => text(row.stoneType) === 'diamond'),
    ),
    colorstones: stoneFacts(
      asList(snapshot?.colorstones),
      [],
      stoneRows.filter((row) => text(row.stoneType) === 'colorstone'),
    ),
    labour: labourField(scan?.labourChargeAmount, scan?.labourChargeUnit),
    labourBasis: pick([scan], ['labourWeightBasis'], basisText),
    labourAmount: pick([pricing], ['labourAmount'], num),
    wastageCode: pick([pricing, scan], ['wastageCode'], nonEmpty),
    wastagePercent: pick([pricing, scan], ['wastagePercent'], percentText),
    wastageBasis: pick([pricing], ['wastageWeightBasis'], basisText),
    wastageWeight: pick([pricing], ['wastageWeightGrams'], grams),
    wastageRatePerGram: pick([pricing], ['wastageRatePerGram'], positive),
    wastageAmount: pick([pricing], ['wastageAmount'], positive),
    otherCharges: chargeFacts(asList(scan?.otherChargesItems)),
    otherChargesOnTag: null,
    otherChargesTotal: pick([pricing], ['otherChargesAmount'], positive),
    diamondAmount: pick([pricing], ['diamondAmount'], positive),
    colorstoneAmount: pick([pricing], ['colorstoneAmount'], positive),
    subtotal: null,
    finalMrp: num(item.mrp) ?? pick(priced, ['ultimateMrp'], num),
  };

  const when = formatHistoryWhen(item.createdAt, now);
  return buildView(
    {
      title: text(item.itemName) || 'Wishlist item',
      tagCode: text(item.tagCode),
      when: when ? `Added ${when}` : '',
      note: '',
    },
    facts,
  );
}
