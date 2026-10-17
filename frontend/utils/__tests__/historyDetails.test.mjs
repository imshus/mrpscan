/**
 * Pins History's read-only tag details (utils/historyDetails.ts): a past
 * scan (GET /history/scans/:scanId — `details` read off the tag, `pricing`
 * the inputs and breakdown) and a wishlist add (GET /history/wishlist/:id —
 * the app's own wishlist snapshot) read into the review card's tiles and the
 * MRP breakdown, showing only what was recorded: no tile for a part the
 * piece does not have, a dash for a tag that was read and never priced.
 * The scan and wishlist answers are real server responses
 * (fixtures/historyServer.json), so the field names are the server's own.
 *
 * The app's own file is loaded, not a mirror, through node's type stripping
 * with a resolve hook for the '@/' alias and extensionless imports.
 *
 * Run with:  node --test utils/__tests__/historyDetails.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

registerHooks({
  resolve(specifier, context, nextResolve) {
    let file = null;
    if (specifier.startsWith('@/')) file = path.join(ROOT, specifier.slice(2));
    else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      file = path.join(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (file === null) return nextResolve(specifier, context);
    if (!path.extname(file)) file = ['.ts', '.tsx'].map((ext) => file + ext).find(existsSync) ?? file;
    const format = file.endsWith('.ts') ? 'module-typescript' : undefined;
    return { url: pathToFileURL(file).href, format, shortCircuit: true };
  },
});

const { scanDetailView, wishlistDetailView, UNPRICED_NOTE } = await import('@/utils/historyDetails');
const { buildWishlistItem, wishlistAddPayload } = await import('@/utils/wishlistUtils');

// 17 Oct 2026, 10:30 am local.
const NOW = new Date(2026, 9, 17, 10, 30);
const at = (day, hours, minutes) => new Date(2026, 9, day, hours, minutes).toISOString();

/** Each tile as "Label: value" lines, a trailing " *" on its amount. */
const tilesOf = (view) =>
  Object.fromEntries(
    view.tiles.map((tile) => [
      `${tile.key} ${tile.title} (${tile.tone})`,
      tile.fields.map((field) => `${field.label}: ${field.value}${field.amount ? ' *' : ''}`),
    ]),
  );
const linesOf = (view) => view.breakdown.map((line) => `${line.label}: ${line.value}${line.amount ? ' *' : ''}`);

/**
 * Real answers, captured from the backend's own controllers and services
 * (POST /scans/:scanId/analyze, /calculate, POST /wishlist, then GET
 * /history/*) over an in-memory MongoDB with the model's reading and the
 * live rate stood in for: a diamond necklace read off its tag, priced by the
 * card (cash, labour 850 a gram, 8% wastage on the gross weight, Rs 500 other
 * charges); the same tag only read, at the price the analysis worked out;
 * one read with no live rate; and the priced one as the app saved it to the
 * wishlist (utils/wishlistUtils buildWishlistItem + wishlistAddPayload).
 */
const SERVER = JSON.parse(readFileSync(path.join(ROOT, 'utils', '__tests__', 'fixtures', 'historyServer.json'), 'utf8'));

test('fixture: the server shape the parser reads', () => {
  const { details, pricing } = SERVER.pricedScan;
  for (const key of ['jewelleryType', 'grossWeight', 'netWeight', 'karat', 'purity', 'serialNumber', 'itemCode',
    'packetCode', 'diamonds', 'colorstones', 'labour', 'wastage', 'otherCharges']) {
    assert.ok(key in details, `details.${key}`);
  }
  assert.deepEqual(Object.keys(pricing).sort(), ['breakdown', 'inputs', 'rules']);
  for (const key of ['grossWt', 'netWt', 'purityKarat', 'calculationMode', 'diamonds', 'colorstones',
    'labourChargeAmount', 'labourChargeUnit', 'labourWeightBasis']) {
    assert.ok(key in pricing.inputs, `pricing.inputs.${key}`);
  }
  for (const key of ['goldAmount', 'pureWeight', 'goldRateApplied', 'effectivePurityPercent',
    'purityAdjustedGoldRatePerGram', 'diamondAmount', 'colorstoneAmount', 'diamondLineItems', 'colorstoneLineItems',
    'labourRate', 'labourUnit', 'labourWeightBasis', 'labourAmount', 'wastageCode', 'wastagePercent',
    'wastageWeightBasis', 'wastageWeightGrams', 'wastageRatePerGram', 'wastageAmount', 'otherCharges', 'subtotal',
    'netWeightUsed', 'netWeightEstimated', 'finalMRP', 'finalMRPRounded']) {
    assert.ok(key in pricing.breakdown, `pricing.breakdown.${key}`);
  }
  assert.equal(SERVER.wishlistEntry.scanId, SERVER.pricedScan.scanId, 'the wishlist line names its scan');
  assert.equal(SERVER.wishlistEntry.snapshot.scanId, SERVER.pricedScan.scanId, 'and so does the item it saved');
});

test('priced scan (server answer): every tile as priced, the breakdown, the MRP', () => {
  const view = scanDetailView(SERVER.pricedScan, NOW);
  assert.equal(view.title, 'Gold Necklace');
  assert.equal(view.tagCode, 'NK10432');
  assert.match(view.when, /^Scanned /);
  assert.equal(view.mrp, '₹ 1,49,790');
  assert.equal(view.note, '');
  assert.deepEqual(tilesOf(view), {
    'tag Tag (plain)': ['Jewellery Type: Diamond', 'Serial No.: NK10432', 'Item Code: NK', 'Packet Code: PK-77'],
    'gold Gold (gold)': [
      'Gross Weight: 10.5 g',
      'Net Weight: 10 g',
      'Karat: 22K',
      'Purity: 91.6%',
      'Pure Weight: 9.16 g',
      // Priced in cash: the review card calls it Retail.
      'Gold Rate: Retail',
      'Current Gold Rate: ₹1,18,164 /10gm',
      'Gold Amount: ₹1,18,164 *',
    ],
    'diamond-0 Diamond 1 (diamond)': [
      'Weight: 0.25 ct',
      'Pieces: 12',
      'Shape: RD',
      'Quality: VVS-EF',
      'Colour: EF',
      'Clarity: VVS',
      'Packet Code: P1',
      'Diamond Rate: ₹50,000 /ct',
      'Diamond Amount: ₹12,500 *',
    ],
    'colorstone-0 Colorstone 1 (plain)': [
      'Stone: Ruby',
      'Weight: 0.1 ct',
      'Pieces: 3',
      'Colour: RED',
      'Clarity: SI',
      'CS Rate: ₹2,000 /ct',
      'CS Amount: ₹200 *',
    ],
    'labour Labour Charge (labour)': ['Labour Rate: ₹850', 'Weight Used: Net wt', 'Labour Amount: ₹8,500 *'],
    'wastage Wastage (wastage)': [
      'Wastage %: 8%',
      'Weight Used: Gross wt',
      'Wastage Weight: 0.84 g',
      'Wastage Rate: ₹11,816 /g',
      'Wastage Amount: ₹9,926 *',
    ],
    'other Other Charges (plain)': ['Other Charges Total: ₹500 *'],
  });
  // The subtotal is the MRP itself here, so it is not a line of its own.
  assert.deepEqual(linesOf(view), [
    'Gold Amount: ₹1,18,164',
    'Diamond Amount: ₹12,500',
    'Colorstone Amount: ₹200',
    'Labour Amount: ₹8,500',
    'Wastage Amount: ₹9,926',
    'Other Charges: ₹500',
    'Final MRP: ₹1,49,790 *',
  ]);
});

test('scan only read (server answer): the price the analysis made, and what the tag said', () => {
  const view = scanDetailView(SERVER.readScan, NOW);
  assert.equal(SERVER.readScan.status, 'read');
  assert.equal(SERVER.readScan.pricing, null);
  // The price its list row shows, not a dash.
  assert.equal(view.mrp, '₹ 1,40,780');
  assert.equal(view.note, '');
  assert.deepEqual(linesOf(view), []);
  const tiles = tilesOf(view);
  // A fineness past 100 is shown as printed.
  assert.deepEqual(tiles['gold Gold (gold)'], ['Gross Weight: 10.5 g', 'Net Weight: 10 g', 'Karat: 22K', 'Purity: 916']);
  assert.deepEqual(tiles['diamond-0 Diamond 1 (diamond)'], [
    'Weight: 0.25 ct',
    'Pieces: 12',
    'Shape: RD',
    'Quality: VVS-EF',
    'Colour: EF',
    'Clarity: VVS',
    'Packet Code: P1',
    'Diamond Rate: ₹50,000 /ct',
  ]);
  assert.deepEqual(tiles['labour Labour Charge (labour)'], ['Labour (on tag): LBR 850']);
  assert.deepEqual(tiles['wastage Wastage (wastage)'], ['Wastage %: 8%']);
  assert.deepEqual(tiles['other Other Charges (plain)'], ['Other Charges (on tag): 500']);
});

test('scan read with no live rate (server answer): a dash and the note', () => {
  const view = scanDetailView(SERVER.unpricedScan, NOW);
  assert.equal(view.title, '22K Diamond Jewellery');
  assert.equal(view.tagCode, 'ZZ-9');
  assert.equal(view.mrp, '—');
  assert.equal(view.note, UNPRICED_NOTE);
  assert.deepEqual(view.breakdown, []);
  // No Masters item matched: no Item Code.
  assert.deepEqual(tilesOf(view)['tag Tag (plain)'], ['Jewellery Type: Diamond', 'Serial No.: ZZ-9', 'Packet Code: PK-77']);
});

test('scan: a net weight worked out from the gross says so; a percent labour reads as one', () => {
  const { pricing } = SERVER.pricedScan;
  const view = scanDetailView(
    {
      ...SERVER.pricedScan,
      pricing: {
        ...pricing,
        inputs: { ...pricing.inputs, netWt: 0, labourChargeAmount: 12, labourChargeUnit: 'Percent' },
        breakdown: { ...pricing.breakdown, netWeightUsed: 10.36, netWeightEstimated: true, labourRate: 12, labourUnit: 'Percent' },
      },
    },
    NOW,
  );
  const tiles = tilesOf(view);
  assert.equal(tiles['gold Gold (gold)'][1], 'Net Weight (est.): 10.36 g');
  assert.equal(tiles['labour Labour Charge (labour)'][0], 'Labour (% of gold): 12%');
});

test('scan: no wastage on the piece is no tile and no line', () => {
  const { pricing } = SERVER.pricedScan;
  const view = scanDetailView(
    {
      ...SERVER.pricedScan,
      pricing: {
        ...pricing,
        breakdown: { ...pricing.breakdown, wastagePercent: 0, wastageWeightGrams: 0, wastageAmount: 0 },
      },
    },
    NOW,
  );
  assert.equal(view.tiles.some((tile) => tile.key === 'wastage'), false);
  assert.equal(linesOf(view).some((line) => line.startsWith('Wastage')), false);
});

test('scan: junk is no view; an entry with nothing recorded is its header alone', () => {
  assert.equal(scanDetailView(null, NOW), null);
  assert.equal(scanDetailView('x', NOW), null);
  const bare = scanDetailView({ scanId: 's4', finalMRP: 999.5, status: 'priced' }, NOW);
  assert.equal(bare.mrp, '₹ 1,000');
  assert.equal(bare.when, '');
  assert.deepEqual(bare.tiles, []);
  assert.deepEqual(bare.breakdown, []);
});

const WISHLIST_ITEM = {
  id: 'w1',
  itemName: '22K Gold Ring',
  tagCode: 'GLD-R100',
  mrp: 44520,
  createdAt: at(17, 7, 24),
  snapshot: {
    selectedType: 'Gold',
    scanData: {
      sku: 'R-100',
      itemCode: '',
      packetCode: '',
      grossWt: '4.500',
      netWt: '4.200',
      karat: '22K',
      tunch: '',
      customPurityPercent: '',
      labourChargeAmount: '650',
      labourChargeUnit: 'Per Gram',
      labourWeightBasis: 'gross',
      calculationRate: 'cash',
      wastagePercent: '',
      otherChargesItems: [{ id: 'c1', name: 'Hallmark', amount: 45 }],
    },
    structuredData: {},
    diamonds: [],
    colorstones: [],
    pricing: {
      selectedKarat: '22K',
      effectivePurityPercent: 91.6,
      pureWtGrams: 3.8472,
      goldRatePerGram: 10000,
      goldBasePrice: 38472,
      stoneRows: [],
      diamondAmount: 0,
      colorstoneAmount: 0,
      labourAmount: 2925,
      wastageCode: 'WS-08',
      wastagePercent: 8,
      wastageWeightBasis: 'net',
      wastageWeightGrams: 0.336,
      wastageRatePerGram: 9160,
      wastageAmount: 3077.76,
      otherChargesAmount: 45,
      ultimateMrp: 44519.76,
    },
    ultimateMrp: 44519.76,
    goldBasePrice: 38472,
    goldRatePerGram: 10000,
    pureWtGrams: 3.8472,
    effectivePurityPercent: 91.6,
  },
};

test('wishlist add: the snapshot read into the same tiles and breakdown', () => {
  const view = wishlistDetailView(WISHLIST_ITEM, NOW);
  assert.equal(view.title, '22K Gold Ring');
  assert.equal(view.tagCode, 'GLD-R100');
  assert.equal(view.when, 'Added Today, 7:24 am');
  assert.equal(view.mrp, '₹ 44,520');
  assert.equal(view.note, '');
  assert.deepEqual(tilesOf(view), {
    'tag Tag (plain)': ['Jewellery Type: Gold', 'Serial No.: R-100'],
    'gold Gold (gold)': [
      'Gross Weight: 4.5 g',
      'Net Weight: 4.2 g',
      'Karat: 22K',
      'Purity: 91.6%',
      'Pure Weight: 3.847 g',
      'Gold Rate: Retail',
      'Current Gold Rate: ₹91,600 /10gm',
      'Gold Amount: ₹38,472 *',
    ],
    'labour Labour Charge (labour)': ['Labour Rate: ₹650', 'Weight Used: Gross wt', 'Labour Amount: ₹2,925 *'],
    'wastage Wastage (wastage)': [
      'Wastage Code: WS-08',
      'Wastage %: 8%',
      'Weight Used: Net wt',
      'Wastage Weight: 0.336 g',
      'Wastage Rate: ₹9,160 /g',
      'Wastage Amount: ₹3,078 *',
    ],
    'other Other Charges (plain)': ['Hallmark: ₹45', 'Other Charges Total: ₹45 *'],
  });
  assert.deepEqual(linesOf(view), [
    'Gold Amount: ₹38,472',
    'Labour Amount: ₹2,925',
    'Wastage Amount: ₹3,078',
    'Other Charges: ₹45',
    'Final MRP: ₹44,520 *',
  ]);
});

test('wishlist add: a diamond takes its amount from the priced stone rows', () => {
  const view = wishlistDetailView(
    {
      id: 'w2',
      itemName: '18K Diamond Ring',
      mrp: 30000,
      createdAt: at(15, 4, 24),
      snapshot: {
        selectedType: 'Diamond',
        diamonds: [
          { stoneType: 'diamond', weight: '0.10', unit: 'ct', pieces: '6', shape: 'Round', color: 'GH', clarity: 'SI', quality: '', rate: '50000', packetCode: 'P1' },
        ],
        pricing: {
          stoneRows: [
            { sequenceIndex: 0, displayTitle: 'Diamond 1', stoneType: 'diamond', rate: '₹50,000', quality: '', weight: '0.1 ct', amount: 5000, amountDisplay: '₹5,000' },
          ],
          diamondAmount: 5000,
        },
      },
    },
    NOW,
  );
  assert.equal(view.when, 'Added 15 Oct, 4:24 am');
  assert.deepEqual(tilesOf(view)['diamond-0 Diamond 1 (diamond)'], [
    'Weight: 0.1 ct',
    'Pieces: 6',
    'Shape: Round',
    'Colour: GH',
    'Clarity: SI',
    'Packet Code: P1',
    'Diamond Rate: ₹50,000 /ct',
    'Diamond Amount: ₹5,000 *',
  ]);
  assert.deepEqual(linesOf(view), ['Diamond Amount: ₹5,000', 'Final MRP: ₹30,000 *']);
});

test('wishlist add (server answer): the snapshot the app saved, in the same tiles as its scan', () => {
  const view = wishlistDetailView(SERVER.wishlistEntry, NOW);
  const scan = scanDetailView(SERVER.pricedScan, NOW);
  assert.equal(view.title, 'Gold Necklace');
  assert.equal(view.tagCode, 'NK10432');
  assert.match(view.when, /^Added /);
  assert.equal(view.mrp, scan.mrp);
  assert.deepEqual(linesOf(view), linesOf(scan));
  const tiles = tilesOf(view);
  const scanTiles = tilesOf(scan);
  for (const key of ['gold Gold (gold)', 'diamond-0 Diamond 1 (diamond)', 'labour Labour Charge (labour)',
    'wastage Wastage (wastage)']) {
    assert.deepEqual(tiles[key], scanTiles[key], key);
  }
  // The card's Item Code is the tag's whole number (processing.tsx); the
  // scan line's is the Masters item it matched.
  assert.deepEqual(tiles['tag Tag (plain)'], [
    'Jewellery Type: Diamond',
    'Serial No.: NK10432',
    'Item Code: NK10432',
    'Packet Code: PK-77',
  ]);
  // The card's own charge list is kept with the item; the scan line has only its total.
  assert.deepEqual(tiles['other Other Charges (plain)'], ['Hallmark: ₹500', 'Other Charges Total: ₹500 *']);
});

test('wishlist add: the POST body names the scan and the catalogue name; an old item names neither', () => {
  const body = wishlistAddPayload(
    buildWishlistItem({
      scanData: SERVER.wishlistEntry.snapshot.scanData,
      structuredData: {},
      selectedType: 'Diamond',
      diamonds: [],
      colorstones: [],
      pricing: SERVER.wishlistEntry.snapshot.pricing,
      scanTimestamp: '2026-10-17T05:00:00.000Z',
      scanId: ' scan-fx-priced ',
    }),
  );
  assert.equal(body.scanId, 'scan-fx-priced');
  assert.equal(body.snapshot.scanId, 'scan-fx-priced', 'kept on the wishlist item, in its snapshot');
  assert.equal(body.itemName, 'Gold Necklace');
  assert.deepEqual(
    Object.keys(body).sort(),
    ['calculationRate', 'itemId', 'itemName', 'priceBadge', 'scanId', 'scanTimestamp', 'snapshot', 'tagCode', 'title', 'totalMrp'],
  );

  const old = wishlistAddPayload({
    id: 'wl-old',
    title: 'Gold',
    tagCode: 'R-1',
    priceBadge: '₹ 1',
    totalMrp: 1,
    addedAt: '',
    scanTimestamp: '',
    snapshot: { scanData: { itemName: '' } },
  });
  assert.equal('scanId' in old, false);
  assert.equal('itemName' in old, false);
});

test('wishlist add: no snapshot is the header and the MRP alone; junk is no view', () => {
  const view = wishlistDetailView({ id: 'w3', itemName: 'Chain', mrp: 1500, createdAt: at(17, 9, 0) }, NOW);
  assert.equal(view.mrp, '₹ 1,500');
  assert.deepEqual(view.tiles, []);
  assert.deepEqual(view.breakdown, []);
  assert.equal(wishlistDetailView(undefined, NOW), null);
});
