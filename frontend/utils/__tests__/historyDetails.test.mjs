/**
 * Pins History's read-only tag details (utils/historyDetails.ts): a past
 * scan (GET /history/scans/:scanId — `details` read off the tag, `pricing`
 * the inputs and breakdown) and a wishlist add (GET /history/wishlist/:id —
 * the app's own wishlist snapshot) read into the review card's tiles and the
 * MRP breakdown, showing only what was recorded: no tile for a part the
 * piece does not have, a dash for a tag that was read and never priced.
 *
 * The app's own file is loaded, not a mirror, through node's type stripping
 * with a resolve hook for the '@/' alias and extensionless imports.
 *
 * Run with:  node --test utils/__tests__/historyDetails.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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

const PRICED_SCAN = {
  scanId: 's1',
  itemName: '18K Diamond Necklace',
  tagCode: 'TAG-10432',
  finalMRP: 143025,
  status: 'priced',
  createdAt: at(17, 8, 59),
  updatedAt: at(17, 9, 1),
  details: {
    jewelleryType: 'DIAMOND',
    grossWeight: { value: '10.300', confidence: 92 },
    netWeight: '9.800',
    karat: '18',
    purity: '75',
    serialNumber: 'SR-77',
    itemCode: 'NK01',
    packetCode: 'PK-9',
    diamonds: [{ weight: '0.25', unit: 'ct', pieces: '12', shape: 'Round', quality: 'VVS', color: 'EF', clarity: 'VVS1', rate: '45000' }],
    colorstones: [{ weight: '0.5', unit: 'g', rate: '2000' }],
    labour: 'MC 850',
  },
  pricing: {
    grossWt: 10.25,
    netWt: 9.8,
    purityKarat: '18K',
    calculationMode: 'rtgs',
    labourWeightBasis: 'net',
    diamonds: [{ weight: 0.25, rate: 45000, discountPercent: 10, unit: 'ct' }],
    colorstones: [{ weight: 0.5, rate: 2000, unit: 'g' }],
    manualLabour: { amount: 850, unit: 'Per Gram' },
    otherCharges: 500,
    effectivePurityPercent: 75,
    purityAdjustedGoldRatePerGram: 11250,
    breakdown: {
      pureWeight: 7.35,
      goldRateApplied: 15000,
      goldAmount: 110250,
      diamondAmount: 10125,
      colorstoneAmount: 5000,
      labourAmount: 8330,
      labourChargeType: 'MANUAL',
      wastageCode: 'WS-08',
      wastagePercent: 8,
      wastageWeightBasis: 'net',
      wastageWeightGrams: 0.784,
      wastageRatePerGram: 11250,
      wastageAmount: 8820,
      otherCharges: 500,
      subtotal: 143025,
      netWeightUsed: 9.8,
      netWeightEstimated: false,
    },
    diamondLineItems: [{ index: 1, weight: 0.25, rate: 45000, discountPercent: 10, amount: 10125 }],
    colorstoneLineItems: [{ index: 1, weight: 2.5, rate: 2000, amount: 5000 }],
    finalMRP: 143025,
    finalMRPRounded: 143025,
  },
};

test('priced scan: header, MRP, every tile as priced, the breakdown', () => {
  const view = scanDetailView(PRICED_SCAN, NOW);
  assert.equal(view.title, '18K Diamond Necklace');
  assert.equal(view.tagCode, 'TAG-10432');
  assert.equal(view.when, 'Scanned Today, 8:59 am');
  assert.equal(view.mrp, '₹ 1,43,025');
  assert.equal(view.note, '');
  assert.deepEqual(tilesOf(view), {
    'tag Tag (plain)': ['Jewellery Type: Diamond', 'Serial No.: SR-77', 'Item Code: NK01', 'Packet Code: PK-9'],
    'gold Gold (gold)': [
      // What was priced, not what was read: 10.25 g, not the tag's 10.300.
      'Gross Weight: 10.25 g',
      'Net Weight: 9.8 g',
      'Karat: 18K',
      'Purity: 75%',
      'Pure Weight: 7.35 g',
      'Gold Rate: RTGS',
      'Current Gold Rate: ₹1,12,500 /10gm',
      'Gold Amount: ₹1,10,250 *',
    ],
    'diamond-0 Diamond 1 (diamond)': [
      'Weight: 0.25 ct',
      'Pieces: 12',
      'Shape: Round',
      'Quality: VVS',
      'Colour: EF',
      'Clarity: VVS1',
      'Diamond Rate: ₹45,000 /ct',
      'Discount: 10%',
      'Diamond Amount: ₹10,125 *',
    ],
    'colorstone-0 Colorstone 1 (plain)': ['Weight: 0.5 g', 'CS Rate: ₹2,000 /ct', 'CS Amount: ₹5,000 *'],
    'labour Labour Charge (labour)': ['Labour Rate: ₹850', 'Weight Used: Net wt', 'Labour Amount: ₹8,330 *'],
    'wastage Wastage (wastage)': [
      'Wastage Code: WS-08',
      'Wastage %: 8%',
      'Weight Used: Net wt',
      'Wastage Weight: 0.784 g',
      'Wastage Rate: ₹11,250 /g',
      'Wastage Amount: ₹8,820 *',
    ],
    'other Other Charges (plain)': ['Other Charges Total: ₹500 *'],
  });
  // The subtotal is the MRP itself here, so it is not a line of its own.
  assert.deepEqual(linesOf(view), [
    'Gold Amount: ₹1,10,250',
    'Diamond Amount: ₹10,125',
    'Colorstone Amount: ₹5,000',
    'Labour Amount: ₹8,330',
    'Wastage Amount: ₹8,820',
    'Other Charges: ₹500',
    'Final MRP: ₹1,43,025 *',
  ]);
});

test('scan read and never priced: a dash, the note, only what the tag said', () => {
  const view = scanDetailView(
    {
      scanId: 's2',
      itemName: '',
      tagCode: 'TAG-1',
      finalMRP: null,
      status: 'read',
      createdAt: at(16, 7, 24),
      details: {
        grossWeight: { value: '6.750', confidence: 90 },
        netWeight: '',
        karat: '22k',
        purity: '916',
        labour: { value: 'MC 850', confidence: 70 },
        diamonds: [],
        otherChargesItems: [{ name: 'Hallmark', amount: 45 }, { name: 'Box', amount: 0 }],
      },
      pricing: null,
    },
    NOW,
  );
  assert.equal(view.title, 'Tag scan');
  assert.equal(view.when, 'Scanned Yesterday, 7:24 am');
  assert.equal(view.mrp, '—');
  assert.equal(view.note, UNPRICED_NOTE);
  assert.deepEqual(view.breakdown, []);
  assert.deepEqual(tilesOf(view), {
    // A fineness past 100 is shown as printed.
    'gold Gold (gold)': ['Gross Weight: 6.75 g', 'Karat: 22K', 'Purity: 916'],
    'labour Labour Charge (labour)': ['Labour (on tag): MC 850'],
    'other Other Charges (plain)': ['Hallmark: ₹45'],
  });
});

test('scan: a net weight worked out from the gross says so; a percent labour reads as one', () => {
  const view = scanDetailView(
    {
      scanId: 's3',
      finalMRP: 5000,
      status: 'priced',
      pricing: {
        grossWt: 6.75,
        netWt: 0,
        labourRatePerUnit: 12,
        labourUnit: 'Percent',
        breakdown: { netWeightUsed: 6.6, netWeightEstimated: true, goldAmount: 4464.29, labourAmount: 535.71, wastageAmount: 0, wastagePercent: 0 },
        finalMRPRounded: 5000,
      },
    },
    NOW,
  );
  const tiles = tilesOf(view);
  assert.deepEqual(tiles['gold Gold (gold)'], ['Gross Weight: 6.75 g', 'Net Weight (est.): 6.6 g', 'Gold Amount: ₹4,464 *']);
  assert.deepEqual(tiles['labour Labour Charge (labour)'], ['Labour (% of gold): 12%', 'Labour Amount: ₹536 *']);
  // No wastage on the piece: no tile at all, and no line in the breakdown.
  assert.equal(view.tiles.some((tile) => tile.key === 'wastage'), false);
  assert.deepEqual(linesOf(view), ['Gold Amount: ₹4,464', 'Labour Amount: ₹536', 'Final MRP: ₹5,000 *']);
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

test('wishlist add: no snapshot is the header and the MRP alone; junk is no view', () => {
  const view = wishlistDetailView({ id: 'w3', itemName: 'Chain', mrp: 1500, createdAt: at(17, 9, 0) }, NOW);
  assert.equal(view.mrp, '₹ 1,500');
  assert.deepEqual(view.tiles, []);
  assert.deepEqual(view.breakdown, []);
  assert.equal(wishlistDetailView(undefined, NOW), null);
});
