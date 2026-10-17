/**
 * Pins the cart (utils/cartInvoice.ts, utils/invoiceLines.ts):
 *
 *  - the Grand Total is the pieces' MRPs as the wishlist shows them, added
 *    up (the design's ₹82,694 + ₹31,437 = ₹1,14,131), printed "₹ 1,14,131";
 *  - ticked items go into the cart in the wishlist's order;
 *  - each piece bills exactly the lines a single-item invoice of it would
 *    (buildInvoiceLines on its own saved breakdown), one piece after another,
 *    its first line naming it, so the subtotal is the pieces' MRPs, each
 *    rounded once — and the pieces sent are what each one bills;
 *  - a saved item without a whole breakdown (or whose breakdown disagrees
 *    with the price it shows) is named, never billed at made-up figures;
 *  - GET /history/checkouts/:id is read defensively.
 *
 * The app's own files are loaded, not a mirror, through node's type
 * stripping with a resolve hook for the '@/' alias. Where the backend
 * checkout sits beside this app, the server's own invoiceMath.js is run on
 * the cart's lines too; without it those cases are skipped.
 *
 * Run with:  node --test utils/__tests__/cartInvoice.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

registerHooks({
  resolve(specifier, context, nextResolve) {
    let file = null;
    if (specifier.startsWith('@/')) file = path.join(ROOT, specifier.slice(2));
    // Only the app's TypeScript: the backend's own requires resolve as usual.
    else if (specifier.startsWith('.') && /^file:.*\.tsx?$/.test(context.parentURL ?? '')) {
      file = path.join(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (file === null) return nextResolve(specifier, context);
    if (!path.extname(file)) file = ['.ts', '.tsx'].map((ext) => file + ext).find(existsSync) ?? file;
    const format = file.endsWith('.ts') ? 'module-typescript' : undefined;
    return { url: pathToFileURL(file).href, format, shortCircuit: true };
  },
});

const {
  buildCartInvoice,
  cartGrandTotal,
  cartPieceFromWishlistItem,
  cartPieceLabel,
  formatCartPrice,
  isBillablePiece,
  readCheckoutDetail,
  resolveCart,
  selectionInListOrder,
} = await import('@/utils/cartInvoice');
const { invoiceLinesInputFromPricing } = await import('@/utils/invoiceLines');
const { buildInvoiceLines, roundHalfUp, sumLineAmounts } = await import('@/utils/moneyMath');

/** The server's invoice arithmetic, when the backend checkout is beside this app. */
const SERVER_INVOICE_MATH = path.resolve(ROOT, '..', '..', 'backend', 'src', 'services', 'invoiceMath.js');
const serverMath = existsSync(SERVER_INVOICE_MATH)
  ? createRequire(import.meta.url)(SERVER_INVOICE_MATH)
  : null;
const NO_SERVER = serverMath ? false : 'backend checkout not found beside the app';

// ---- Two saved tags, as the wishlist keeps them (snapshot.pricing is the
// breakdown the result card showed when the tag was saved).

/** 22K necklace: gold, labour, wastage at the Current Gold Rate. */
const NECKLACE_PRICING = {
  selectedKarat: '22K',
  netWtGrams: 8.769,
  goldBasePrice: 70123.456,
  goldRatePerGram: 15172.5,
  stoneRows: [],
  labourAmount: 8914.2,
  wastagePercent: 3,
  wastageWeightGrams: 0.263,
  wastageRatePerGram: 13898.01,
  wastageAmount: 0.263 * 13898.01,
  otherChargesAmount: 0,
};
NECKLACE_PRICING.ultimateMrp =
  NECKLACE_PRICING.goldBasePrice + NECKLACE_PRICING.labourAmount + NECKLACE_PRICING.wastageAmount;

/** 18K diamond ring: a diamond at 5% off its rate, labour, a hallmark charge. */
const RING_PRICING = {
  selectedKarat: '18K',
  netWtGrams: 3.12,
  goldBasePrice: 5284.37,
  goldRatePerGram: 15172.5,
  stoneRows: [
    {
      sequenceIndex: 0,
      displayTitle: 'Diamond 1',
      stoneType: 'diamond',
      rate: '87500',
      quality: 'VVS-EF',
      weight: '0.284',
      amount: 0.284 * 87500 * 0.95,
      amountDisplay: '₹23,608',
    },
  ],
  labourAmount: 2500,
  otherChargesAmount: 45,
};
RING_PRICING.ultimateMrp =
  RING_PRICING.goldBasePrice +
  RING_PRICING.stoneRows[0].amount +
  RING_PRICING.labourAmount +
  RING_PRICING.otherChargesAmount;

const wishlistItem = (id, { title, tagCode, itemName, karat, pricing, charges = [], remarks = '' }) => ({
  id,
  title,
  tagCode,
  priceBadge: '',
  calculationRate: 'rtgs',
  totalMrp: roundHalfUp(pricing.ultimateMrp),
  addedAt: '2026-10-16T08:24:00.000Z',
  scanTimestamp: '2026-10-16T08:24:00.000Z',
  snapshot: {
    scanData: { itemName, karat, tunch: '', otherChargesItems: charges, otherChargesRemarks: remarks },
    structuredData: {},
    selectedType: 'Gold',
    diamonds: [],
    colorstones: [],
    pricing,
    ultimateMrp: pricing.ultimateMrp,
  },
});

const NECKLACE = wishlistItem('wl-1', {
  title: 'Gold',
  tagCode: 'TAG-10432',
  itemName: '22K Gold Necklace',
  karat: '22K',
  pricing: NECKLACE_PRICING,
});
const RING = wishlistItem('wl-2', {
  title: 'Diamond',
  tagCode: 'PK-1042',
  itemName: 'Diamond Ring',
  karat: '18K',
  pricing: RING_PRICING,
  charges: [{ id: 'c1', name: 'Hallmark', amount: 45 }],
  remarks: 'BIS',
});

/** The single-item invoice's lines for a saved tag (scan-results -> invoice). */
const singleItemLines = (item) =>
  buildInvoiceLines(
    invoiceLinesInputFromPricing(item.snapshot.pricing, {
      karatFallback: item.snapshot.scanData.karat,
      otherChargeItems: item.snapshot.scanData.otherChargesItems,
      otherChargeRemarks: item.snapshot.scanData.otherChargesRemarks,
    }),
  );

test("single scan: the shared reading is the invoice hook's own, figure for figure", async () => {
  const { parseNumericValue, parseWeightValue } = await import('@/utils/formulaUtils');
  const { wastageLineRatePerGram } = await import('@/utils/moneyMath');
  // useInvoiceComputation's mapping as it stood before the cart (afc4aa2).
  const before = (pricing, selectedKarat, otherChargeItems, otherChargeRemarks) => ({
    karatNote: pricing.selectedKarat || selectedKarat,
    netWtGrams: pricing.netWtGrams,
    goldAmount: pricing.goldBasePrice,
    stones: pricing.stoneRows.map((stone) => ({
      stoneType: stone.stoneType,
      quality: stone.quality,
      carats: parseWeightValue(stone.weight),
      amount: stone.amount,
      listRate: Math.max(0, parseNumericValue(stone.rate)),
    })),
    labourAmount: pricing.labourAmount,
    wastage: {
      grams: pricing.wastageWeightGrams ?? 0,
      ratePerGram: wastageLineRatePerGram(pricing),
      percent: pricing.wastagePercent ?? 0,
      amount: pricing.wastageAmount ?? 0,
    },
    otherCharges: { items: otherChargeItems, remarks: otherChargeRemarks, total: pricing.otherChargesAmount },
    mrp: pricing.ultimateMrp,
  });
  const empty = {
    netWtGrams: 0,
    goldBasePrice: 0,
    goldRatePerGram: 0,
    selectedKarat: '',
    stoneRows: [],
    labourAmount: 0,
    otherChargesAmount: 0,
    ultimateMrp: 0,
  };
  // A price from before pricing rules 3: wastage at the 24K rate per gram.
  const oldWastage = { ...NECKLACE_PRICING, wastageRatePerGram: undefined };
  const charges = [{ id: 'c1', name: 'Hallmark', amount: 45 }];
  for (const [pricing, karat, items, remarks] of [
    [NECKLACE_PRICING, '14K', [], undefined],
    [RING_PRICING, '18K', charges, 'BIS'],
    [oldWastage, '22K', [], ''],
    [empty, '14K', [], undefined],
  ]) {
    const shared = invoiceLinesInputFromPricing(pricing, {
      karatFallback: karat,
      otherChargeItems: items,
      otherChargeRemarks: remarks,
    });
    assert.deepEqual(shared, before(pricing, karat, items, remarks));
    assert.deepEqual(buildInvoiceLines(shared), buildInvoiceLines(before(pricing, karat, items, remarks)));
  }
});

test('price: "₹ 82,694" — whole rupees, half-up, Indian grouping; nothing is "—"', () => {
  assert.equal(formatCartPrice(82694), '₹ 82,694');
  assert.equal(formatCartPrice(114131), '₹ 1,14,131');
  assert.equal(formatCartPrice(12345678), '₹ 1,23,45,678');
  assert.equal(formatCartPrice(999), '₹ 999');
  assert.equal(formatCartPrice(0), '₹ 0');
  assert.equal(formatCartPrice(82693.5), '₹ 82,694');
  assert.equal(formatCartPrice(82693.49), '₹ 82,693');
  assert.equal(formatCartPrice(null), '—');
  assert.equal(formatCartPrice(Number.NaN), '—');
});

test("grand total: the MRPs the wishlist shows, added up (the design's two tags)", () => {
  assert.equal(cartGrandTotal([{ mrp: 82694 }, { mrp: 31437 }]), 114131);
  assert.equal(formatCartPrice(cartGrandTotal([{ mrp: 82694 }, { mrp: 31437 }])), '₹ 1,14,131');
  // Each MRP as its card rounds it, then added.
  assert.equal(cartGrandTotal([{ mrp: 100.5 }, { mrp: 100.5 }]), 202);
  assert.equal(cartGrandTotal([]), 0);
});

test('selection: ticked items in the wishlist order, whatever order they were ticked', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  assert.deepEqual(selectionInListOrder(items, new Set(['d', 'b'])), ['b', 'd']);
  // A tick on an item no longer listed drops out.
  assert.deepEqual(selectionInListOrder(items, new Set(['gone', 'c'])), ['c']);
  assert.deepEqual(selectionInListOrder(items, new Set()), []);
});

test('cart: pieces in the cart order from the wishlist; removed ones counted, duplicates once', () => {
  const { pieces, missing } = resolveCart(['wl-2', 'gone', 'wl-1', 'wl-2'], [NECKLACE, RING]);
  assert.deepEqual(
    pieces.map((piece) => piece.id),
    ['wl-2', 'wl-1'],
  );
  assert.equal(missing, 1);
});

test('piece: the catalogue name, the tag code, the MRP the card shows, and its lines', () => {
  const piece = cartPieceFromWishlistItem(NECKLACE);
  assert.equal(piece.name, '22K Gold Necklace');
  assert.equal(piece.tagCode, 'TAG-10432');
  assert.equal(piece.mrp, roundHalfUp(NECKLACE_PRICING.ultimateMrp));
  assert.equal(piece.problem, null);
  assert.equal(isBillablePiece(piece), true);
  // The lines a single-item invoice of it would bill.
  assert.deepEqual(buildInvoiceLines(piece.lines), singleItemLines(NECKLACE));

  // No catalogue name: the wishlist's own title.
  const untitled = cartPieceFromWishlistItem({
    ...NECKLACE,
    snapshot: { ...NECKLACE.snapshot, scanData: { ...NECKLACE.snapshot.scanData, itemName: '  ' } },
  });
  assert.equal(untitled.name, 'Gold');
});

test('piece: the karat comes from its own scan when the pricing names none', () => {
  const item = wishlistItem('wl-k', {
    title: 'Gold',
    tagCode: 'K-1',
    itemName: '',
    karat: '18K',
    pricing: { ...NECKLACE_PRICING, selectedKarat: '' },
  });
  const piece = cartPieceFromWishlistItem(item);
  assert.equal(piece.lines.karatNote, '18K');
});

test('piece: an item without a whole breakdown is named, never billed', () => {
  const without = (pricing) => cartPieceFromWishlistItem({ ...NECKLACE, snapshot: { ...NECKLACE.snapshot, pricing } });

  for (const [label, piece] of [
    ['no pricing', without(undefined)],
    ['no stone rows', without({ ...NECKLACE_PRICING, stoneRows: undefined })],
    ['no labour figure', without({ ...NECKLACE_PRICING, labourAmount: undefined })],
    ['no gold figure', without({ ...NECKLACE_PRICING, goldBasePrice: Number.NaN })],
  ]) {
    assert.equal(piece.lines, null, label);
    assert.equal(isBillablePiece(piece), false, label);
    assert.match(piece.problem, /price breakdown/, label);
  }

  const noPrice = without({ ...NECKLACE_PRICING, ultimateMrp: 0 });
  assert.equal(noPrice.lines, null);
  assert.match(noPrice.problem, /without a price/);

  const refused = without({ ...NECKLACE_PRICING, pricingError: 'No live gold rate.' });
  assert.equal(refused.lines, null);
  assert.match(refused.problem, /No live gold rate\./);

  // The breakdown comes to another price than the one the wishlist shows.
  const disagreeing = cartPieceFromWishlistItem({ ...NECKLACE, totalMrp: NECKLACE.totalMrp + 500 });
  assert.equal(disagreeing.lines, null);
  assert.match(disagreeing.problem, /disagree/);
  // Still listed with the price it shows.
  assert.equal(disagreeing.mrp, NECKLACE.totalMrp + 500);
});

test("invoice: each piece's own lines, one after another, each first line naming its piece", () => {
  const pieces = resolveCart(['wl-1', 'wl-2'], [NECKLACE, RING]).pieces;
  const invoice = buildCartInvoice(pieces);
  const necklace = singleItemLines(NECKLACE);
  const ring = singleItemLines(RING);

  assert.equal(invoice.rows.length, necklace.length + ring.length);
  // Every figure exactly the single-item invoice's, in the cart's order.
  const figures = (row) => ({
    description: row.description,
    qty: row.qty,
    qtyUnit: row.qtyUnit,
    price: row.price,
    amount: row.amount,
  });
  assert.deepEqual(invoice.rows.map(figures), [...necklace, ...ring].map(figures));

  // Keys stay unique across pieces.
  assert.equal(new Set(invoice.rows.map((row) => row.key)).size, invoice.rows.length);

  // The first line of each piece names it, beside its karat; the rest keep theirs.
  assert.equal(invoice.rows[0].note, '1. 22K Gold Necklace · TAG-10432 — 22K');
  assert.equal(invoice.rows[necklace.length].note, '2. Diamond Ring · PK-1042 — 18K');
  assert.deepEqual(
    invoice.rows.slice(1, necklace.length).map((row) => row.note),
    necklace.slice(1).map((row) => row.note),
  );
  // Descriptions stay the standard ones the server reads a line's kind from.
  assert.ok(invoice.rows.some((row) => row.description === 'Labour Charge'));
  assert.ok(invoice.rows.some((row) => row.description === 'Wastage (in grams)'));
  // The ring's hallmark charge is its own, under its remarks.
  assert.ok(invoice.rows.some((row) => row.description === 'Hallmark' && row.note === 'Other Charges — BIS'));
});

test('invoice: the subtotal is the MRPs, each rounded once; the pieces sent are what each bills', () => {
  const invoice = buildCartInvoice(resolveCart(['wl-1', 'wl-2'], [NECKLACE, RING]).pieces);
  assert.equal(invoice.subtotal, sumLineAmounts(invoice.rows));
  assert.equal(invoice.subtotal, NECKLACE.totalMrp + RING.totalMrp);
  assert.equal(invoice.subtotal, cartGrandTotal([{ mrp: NECKLACE.totalMrp }, { mrp: RING.totalMrp }]));
  assert.deepEqual(invoice.pieces, [
    { wishlist_item_id: 'wl-1', item_name: '22K Gold Necklace', tag_code: 'TAG-10432', mrp: NECKLACE.totalMrp },
    { wishlist_item_id: 'wl-2', item_name: 'Diamond Ring', tag_code: 'PK-1042', mrp: RING.totalMrp },
  ]);
  assert.equal(
    invoice.pieces.reduce((sum, piece) => sum + piece.mrp, 0),
    invoice.subtotal,
  );
});

test('invoice: one piece alone bills what its single-item invoice bills', () => {
  const invoice = buildCartInvoice([cartPieceFromWishlistItem(RING)]);
  assert.equal(invoice.subtotal, sumLineAmounts(singleItemLines(RING)));
  assert.equal(invoice.pieces.length, 1);
});

test('label: number, name and code; a code that is the name is not repeated', () => {
  assert.equal(cartPieceLabel(0, { name: 'Diamond Ring', tagCode: 'PK-1042' }), '1. Diamond Ring · PK-1042');
  assert.equal(cartPieceLabel(2, { name: 'PK-1042', tagCode: 'PK-1042' }), '3. PK-1042');
  assert.equal(cartPieceLabel(1, { name: 'Ring', tagCode: '' }), '2. Ring');
});

/** The cart's lines as invoice-sheet.tsx sends them. */
const toRequestItems = (rows) =>
  rows.map((row) => ({
    description: row.description,
    note: row.note,
    qty: row.qty,
    qty_unit: row.qtyUnit === 'g' ? 'Gms.' : row.qtyUnit === 'Ct' ? 'CT' : row.qtyUnit,
    hsn: '71131913',
    price: row.price,
    amount: row.amount,
  }));

test("server: the cart's lines come to its subtotal, and only the discounted diamond reads as a discount", { skip: NO_SERVER }, () => {
  const invoice = buildCartInvoice(resolveCart(['wl-1', 'wl-2'], [NECKLACE, RING]).pieces);
  for (const intraState of [true, false]) {
    const figures = serverMath.computeInvoiceFigures({
      lineItems: toRequestItems(invoice.rows),
      gstRate: 3,
      intraState,
    });
    assert.equal(figures.subtotalPaise, invoice.subtotal * 100);
    const discounted = figures.lines.filter((line) => line.discountPaise > 0).map((line) => line.item.description);
    assert.deepEqual(discounted, ['Diamond (in carats)']);
    // The request's own totals pass the server's check.
    serverMath.checkClientTotals({ subtotal: invoice.subtotal }, figures);
  }
});

test('checkout: GET /history/checkouts/:id read as sent', () => {
  assert.deepEqual(
    readCheckoutDetail({
      id: 'i1',
      invoiceNumber: '26-27/1016/00001',
      pieceCount: 2,
      pieces: [
        { itemName: '22K Gold Necklace', tagCode: 'TAG-10432', mrp: 82694 },
        { itemName: 'Diamond Ring', tagCode: 'PK-1042', mrp: '31437' },
      ],
      grandTotal: 117555,
      createdAt: '2026-10-16T08:24:00.000Z',
      customerName: ' Garg Jewellers ',
    }),
    {
      id: 'i1',
      invoiceNumber: '26-27/1016/00001',
      pieceCount: 2,
      pieces: [
        { itemName: '22K Gold Necklace', tagCode: 'TAG-10432', mrp: 82694 },
        { itemName: 'Diamond Ring', tagCode: 'PK-1042', mrp: 31437 },
      ],
      grandTotal: 117555,
      createdAt: '2026-10-16T08:24:00.000Z',
      customerName: 'Garg Jewellers',
    },
  );
});

test('checkout: unreadable pieces dropped, missing figures null, no record null', () => {
  const detail = readCheckoutDetail({
    _id: 'i2',
    pieces: [null, 'x', { itemName: 'Ring', mrp: 'abc' }],
    grandTotal: null,
  });
  assert.equal(detail.id, 'i2');
  assert.equal(detail.pieceCount, null);
  assert.deepEqual(detail.pieces, [{ itemName: 'Ring', tagCode: '', mrp: null }]);
  assert.equal(detail.grandTotal, null);
  assert.equal(detail.invoiceNumber, '');
  assert.equal(readCheckoutDetail({ pieceCount: 0 }).pieceCount, null);
  assert.equal(readCheckoutDetail(null), null);
  assert.equal(readCheckoutDetail([]), null);
  assert.equal(readCheckoutDetail('x'), null);
});
