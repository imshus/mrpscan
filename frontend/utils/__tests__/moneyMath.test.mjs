/**
 * Pins the money arithmetic (utils/moneyMath.ts):
 *
 *  - rounding is commercial half-up on the exact figure: a float that lands
 *    a hair under .50 (23607.499999999996 for 0.284 ct × ₹87,500 less 5%)
 *    still rounds up, as the decimal it stands for does;
 *  - the invoice is rounded once: its lines share out the MRP the card
 *    showed, rounded, so the subtotal is that MRP — wastage included, on its
 *    own line of grams;
 *  - quantities are the 3 places printed and registered, and Qty × Price of
 *    every undiscounted per-gram/per-carat line rounds to its Amount on
 *    them, so the server never reads a discount into it;
 *  - a stone sold below its list rate prints that rate, and the server shows
 *    the discount;
 *  - other charges bill as they were priced into the MRP, never another
 *    scan's list;
 *  - GST is the server's: each line taxed on its own, half-up to the paisa
 *    (CGST + SGST for a Delhi supplier), and the grand total half-up to the
 *    rupee.
 *
 * The module has no imports, so node loads the app's own file directly
 * (type stripping, Node 22.18+ / 24) — no mirrored copy to drift. Where the
 * backend checkout sits beside this app, the server's own invoiceMath.js is
 * also run on the app's lines; without it those cases are skipped.
 *
 * Run with:  node --test utils/__tests__/moneyMath.test.mjs
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  allocateWholeRupees,
  buildInvoiceLines,
  computeGrandTotal,
  computeInvoiceTax,
  isIntraStateSupplier,
  roundHalfUp,
  serverSeesDiscount,
  sumLineAmounts,
  toPaise,
} from '../moneyMath.ts';

/** The server's invoice arithmetic, when the backend checkout is beside this app. */
const SERVER_INVOICE_MATH = fileURLToPath(
  new URL('../../../../backend/src/services/invoiceMath.js', import.meta.url),
);
const serverMath = existsSync(SERVER_INVOICE_MATH)
  ? createRequire(import.meta.url)(SERVER_INVOICE_MATH)
  : null;
const NO_SERVER = serverMath ? false : 'backend checkout not found beside the app';

/** The app's lines as the invoice request sends them (invoice-sheet.tsx). */
const toRequestItems = (rows) =>
  rows.map((row) => ({
    description: row.description,
    qty: row.qty,
    qty_unit: row.qtyUnit === 'g' ? 'Gms.' : row.qtyUnit === 'Ct' ? 'CT' : row.qtyUnit,
    hsn: '71131913',
    price: row.price,
    amount: row.amount,
  }));

/** A small deterministic generator, so a failure names a reproducible piece. */
const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

/** The server's arithmetic for these figures (backend pricingMath.js), float for float. */
const stoneAmount = (carats, rate, discountPercent = 0) => {
  const base = carats * rate;
  return base - base * (discountPercent / 100);
};
const goldAmount = (netWt, purityPercent, ratePer10g) =>
  netWt * (purityPercent / 100) * (ratePer10g / 10);

/** An invoice input with nothing on it but what a case sets. */
const invoice = (overrides) => ({
  karatNote: '18K',
  netWtGrams: 0,
  goldAmount: 0,
  stones: [],
  labourAmount: 0,
  wastage: { grams: 0, ratePerGram: 0, percent: 0, amount: 0 },
  otherCharges: { items: [], remarks: '', total: 0 },
  mrp: 0,
  ...overrides,
});

test('rounding: exact halves go up even when the float sits just under them', () => {
  const diamond = stoneAmount(0.284, 87500, 5);
  assert.notEqual(diamond, 23607.5); // the float is 23607.499999999996
  assert.equal(roundHalfUp(diamond), 23608);

  const labour = 2.002 * 750;
  assert.notEqual(labour, 1501.5);
  assert.equal(roundHalfUp(labour), 1502);

  const gold = goldAmount(1.875, 58.5, 120000);
  assert.notEqual(gold, 13162.5);
  assert.equal(roundHalfUp(gold), 13163);

  // The whole MRP an exact .50: 24.575 g at 18K, ₹1,32,400/10 g, labour ₹610/g.
  const mrp = goldAmount(24.575, 75, 132400) + 24.575 * 610;
  assert.equal(roundHalfUp(mrp), 259021);
});

test('rounding: below a half goes down, negatives mirror, paise round half-up', () => {
  assert.equal(roundHalfUp(2.4), 2);
  assert.equal(roundHalfUp(2.6), 3);
  assert.equal(roundHalfUp(0.49999), 0);
  assert.equal(roundHalfUp(-2.5), -3);
  assert.equal(roundHalfUp(-2.4), -2);
  assert.equal(roundHalfUp(1.005, 2), 1.01);
  assert.equal(roundHalfUp(2611.845, 2), 2611.85);
  assert.equal(roundHalfUp(Number.NaN), 0);
  assert.equal(toPaise(1500.025), 150003);
});

test('allocation: whole rupees that add up to the rounded total', () => {
  // Each rounded alone: 101 + 201 + 51 = 353 against a total of 352.
  assert.deepEqual(allocateWholeRupees([100.5, 200.5, 50.5], 352), [101, 201, 50]);
  // Gold 70,077.2664 + labour 3,392.48 + hallmark 45.40 = 73,515.1464 → 73,515
  // (each rounded alone: 73,514).
  assert.deepEqual(allocateWholeRupees([70077.2664, 3392.48, 45.4], 73515), [70077, 3393, 45]);
  // Gold + two diamonds = 6,33,438.47875 → 6,33,438 (each alone: 6,33,439).
  assert.deepEqual(allocateWholeRupees([572650.51875, 12707.2, 48080.76], 633438), [572650, 12707, 48081]);
  // Nothing moves by a rupee or more, and whole amounts stay as they are.
  assert.deepEqual(allocateWholeRupees([5000, 93750], 98750), [5000, 93750]);
});

test('allocation: amounts that cannot reach the total are refused', () => {
  assert.equal(allocateWholeRupees([100, 200], 500), null);
  assert.equal(allocateWholeRupees([100.4, 200.4], 299), null);
  assert.equal(allocateWholeRupees([-5, 10], 5), null);
});

test('invoice: a wastage line makes the subtotal the MRP the card showed', () => {
  // 10 g net, 18K, RTGS ₹1,25,000/10 g, labour ₹500/g net, wastage 5%.
  const rows = buildInvoiceLines(
    invoice({
      netWtGrams: 10,
      goldAmount: goldAmount(10, 75, 125000),
      labourAmount: 5000,
      wastage: { grams: 0.5, ratePerGram: 12500, percent: 5, amount: 0.5 * 12500 },
      mrp: 105000,
    }),
  );
  const wastage = rows.find((row) => row.key === 'wastage');
  assert.ok(wastage, 'a wastage line');
  assert.equal(wastage.description, 'Wastage (in grams)');
  assert.equal(wastage.qty, 0.5);
  assert.equal(wastage.qtyUnit, 'g');
  assert.equal(wastage.price, 12500); // the 24K rate per gram
  assert.equal(wastage.amount, 6250);
  assert.equal(wastage.note, '5%');

  const subtotal = sumLineAmounts(rows);
  assert.equal(subtotal, 105000);
  const gst = computeInvoiceTax(rows.map((row) => row.amount), 3, false).gst;
  assert.equal(gst, 3150);
  assert.equal(computeGrandTotal(subtotal, gst), 108150);
  // In the card's order: gold, labour, wastage.
  assert.deepEqual(rows.map((row) => row.key), ['gold-base-metal', 'labour-charge', 'wastage']);
});

test('invoice: wastage grams unknown (an older wishlist item) come from amount ÷ rate', () => {
  const rows = buildInvoiceLines(
    invoice({
      netWtGrams: 10,
      goldAmount: 93750,
      wastage: { grams: 0, ratePerGram: 12500, percent: 5, amount: 6250 },
      mrp: 100000,
    }),
  );
  assert.equal(rows.find((row) => row.key === 'wastage').qty, 0.5);
  assert.equal(sumLineAmounts(rows), 100000);
});

test('invoice: lines are rounded once, so they add up to the rounded MRP', () => {
  const gold = goldAmount(7.456, 75, 125317);
  const labour = 7.456 * 455;
  const rows = buildInvoiceLines(
    invoice({
      netWtGrams: 7.456,
      goldAmount: gold,
      labourAmount: labour,
      otherCharges: { items: [{ id: 'h', name: 'Hallmark', amount: 45.4 }], remarks: '', total: 45.4 },
      mrp: gold + labour + 45.4,
    }),
  );
  assert.equal(sumLineAmounts(rows), 73515);
  for (const row of rows) assert.ok(Number.isInteger(row.amount), `${row.key} is whole rupees`);
});

test('invoice: an exact .50 piece bills the rupee half-up gives', () => {
  const diamond = stoneAmount(0.284, 87500, 5);
  const rows = buildInvoiceLines(
    invoice({
      stones: [{ stoneType: 'diamond', quality: 'EF VVS', carats: 0.284, amount: diamond }],
      mrp: diamond,
    }),
  );
  assert.equal(sumLineAmounts(rows), 23608);
});

test('invoice: Qty × Price of each per-unit line rounds to its Amount', () => {
  const gold = goldAmount(7.456, 75, 125317);
  const diamond = stoneAmount(0.37, 61111, 10);
  const colorstone = stoneAmount(1.25, 3333);
  const rows = buildInvoiceLines(
    invoice({
      netWtGrams: 7.456,
      goldAmount: gold,
      stones: [
        { stoneType: 'diamond', quality: 'FG VS', carats: 0.37, amount: diamond, listRate: 61111 },
        { stoneType: 'colorstone', quality: '', carats: 1.25, amount: colorstone, listRate: 3333 },
      ],
      mrp: gold + diamond + colorstone,
    }),
  );
  const [goldLine, diamondLine, colorstoneLine] = rows;
  for (const row of [goldLine, colorstoneLine]) {
    assert.equal(roundHalfUp(row.qty * row.price), row.amount, row.key);
    assert.equal(roundHalfUp(row.price, 2), row.price, `${row.key} price is to the paisa`);
    assert.equal(serverSeesDiscount(row.qty, row.price, row.amount), false, row.key);
  }
  // The gold line prints the rate the card shows (24K rate × 75%), not the
  // amount divided back out; the colourstone its own rate per carat.
  assert.equal(goldLine.price, 9398.78);
  assert.equal(colorstoneLine.price, 3333);
  // The diamond, ₹61,111 less 10%, prints its list rate: 0.37 × 61,111 =
  // 22,611.07 billed at 20,350, the difference shown as its discount.
  assert.equal(diamondLine.price, 61111);
  assert.equal(diamondLine.amount, 20350);
  assert.equal(serverSeesDiscount(diamondLine.qty, diamondLine.price, diamondLine.amount), true);
});

test('invoice: a discounted diamond prints its list rate, and the server reads the discount', () => {
  // 0.284 ct at ₹87,500/ct less 5%: the card's stone row shows ₹87,500/ct.
  const diamond = stoneAmount(0.284, 87500, 5);
  const rows = buildInvoiceLines(
    invoice({
      netWtGrams: 7.5,
      goldAmount: 50000,
      stones: [{ stoneType: 'diamond', quality: 'VVS EF', carats: 0.284, amount: diamond, listRate: 87500 }],
      labourAmount: 5000,
      mrp: 55000 + diamond,
    }),
  );
  const line = rows.find((row) => row.key === 'stone-diamond-0');
  assert.equal(line.price, 87500);
  assert.equal(line.amount, 23608);
  // 0.284 × 87,500 = 24,850 billed at 23,608: a ₹1,242 discount.
  assert.equal(serverSeesDiscount(line.qty, line.price, line.amount), true);

  // No list rate known: a net rate that foots, 0.37 × 54,999.90 → ₹20,350.
  const netDiamond = stoneAmount(0.37, 61111, 10);
  const [, bare] = buildInvoiceLines(
    invoice({
      stones: [{ stoneType: 'diamond', quality: '', carats: 0.37, amount: netDiamond }],
      mrp: netDiamond,
    }),
  );
  assert.equal(bare.price, 54999.9);
  assert.equal(bare.amount, 20350);

  // A discount under a rupee is the line's own rounding to the server: the
  // line prints a price that foots instead of the list rate.
  const tiny = stoneAmount(0.05, 10000, 0.1); // ₹500 less ₹0.50
  const [, tinyLine] = buildInvoiceLines(
    invoice({
      stones: [{ stoneType: 'diamond', quality: '', carats: 0.05, amount: tiny, listRate: 10000 }],
      mrp: tiny,
    }),
  );
  assert.equal(roundHalfUp(tinyLine.qty * tinyLine.price), tinyLine.amount);
  assert.equal(serverSeesDiscount(tinyLine.qty, tinyLine.price, tinyLine.amount), false);
});

test('invoice: wastage grams print to 3 places and the line foots on them', () => {
  // 7.456 g at 5% is 0.3728 g; 10.425 g at 2% is 0.20850000000000002 g;
  // 5.0625 g at 5% is 0.253125 g. The 24K rate at 0.373 g came to ₹4,674.32
  // against ₹4,672 billed: the server printed a ₹2.32 discount that was not.
  const cases = [
    { net: 7.456, percent: 5, ratePerGram: 12531.7, labourPerGram: 455 },
    { net: 10.425, percent: 2, ratePerGram: 12500, labourPerGram: 0 },
    { net: 5.0625, percent: 5, ratePerGram: 13001.3, labourPerGram: 610 },
  ];
  for (const { net, percent, ratePerGram, labourPerGram } of cases) {
    const grams = net * (percent / 100);
    const wastageAmount = grams * ratePerGram;
    const gold = goldAmount(net, 75, ratePerGram * 10);
    const labour = net * labourPerGram;
    const rows = buildInvoiceLines(
      invoice({
        netWtGrams: net,
        goldAmount: gold,
        labourAmount: labour,
        wastage: { grams, ratePerGram, percent, amount: wastageAmount },
        mrp: gold + labour + wastageAmount,
      }),
    );
    const wastage = rows.find((row) => row.key === 'wastage');
    assert.equal(wastage.qty, roundHalfUp(grams, 3), `${net} g: grams to 3 places`);
    for (const row of rows.filter((r) => r.qtyUnit)) {
      assert.equal(Number(row.qty.toFixed(3)), row.qty, `${net} g: ${row.key} qty to 3 places`);
      assert.equal(roundHalfUp(row.qty * row.price), row.amount, `${net} g: ${row.key} foots`);
      assert.equal(serverSeesDiscount(row.qty, row.price, row.amount), false, `${net} g: ${row.key}`);
    }
  }
});

test('invoice: random pieces — undiscounted lines foot, only real discounts read as one', () => {
  const rnd = seeded(20261015);
  for (let i = 0; i < 3000; i += 1) {
    const net = roundHalfUp(0.5 + rnd() * 40, 3);
    const ratePerGram = Math.round(100000 + rnd() * 60000) / 10;
    const percent = rnd() < 0.7 ? 1 + Math.floor(rnd() * 15) : 0;
    const grams = net * (percent / 100);
    const gold = goldAmount(net, 75, ratePerGram * 10);
    const labour = net * Math.round(100 + rnd() * 900);
    const stones = [];
    for (let s = Math.floor(rnd() * 3); s > 0; s -= 1) {
      const carats = roundHalfUp(0.01 + rnd() * 2, 3);
      const listRate = Math.round(1000 + rnd() * 150000);
      const discount = rnd() < 0.5 ? [2, 5, 10][Math.floor(rnd() * 3)] : 0;
      const amount = stoneAmount(carats, listRate, discount);
      stones.push({ stoneType: 'diamond', quality: '', carats, listRate, discount, amount });
    }
    const stoneTotal = stones.reduce((sum, stone) => sum + stone.amount, 0);
    const mrp = gold + labour + grams * ratePerGram + stoneTotal;
    const rows = buildInvoiceLines(
      invoice({
        netWtGrams: net,
        goldAmount: gold,
        labourAmount: labour,
        stones,
        wastage: { grams, ratePerGram, percent, amount: grams * ratePerGram },
        mrp,
      }),
    );
    assert.equal(sumLineAmounts(rows), roundHalfUp(mrp), `piece ${i}: lines add up to the MRP`);
    for (const row of rows.filter((r) => r.qtyUnit)) {
      const stone = row.key.startsWith('stone-') ? stones[Number(row.key.split('-').pop())] : null;
      if (stone && stone.discount > 0 && serverSeesDiscount(row.qty, stone.listRate, row.amount)) {
        assert.equal(row.price, stone.listRate, `piece ${i}: ${row.key} prints its list rate`);
        continue;
      }
      assert.equal(roundHalfUp(row.qty * row.price), row.amount, `piece ${i}: ${row.key} foots`);
      assert.equal(serverSeesDiscount(row.qty, row.price, row.amount), false, `piece ${i}: ${row.key}`);
    }
  }
});

test('invoice: the server registers no discount on wastage, and keeps a real one', { skip: NO_SERVER }, () => {
  const net = 7.456;
  const grams = net * 0.05;
  const gold = goldAmount(net, 75, 125317);
  const labour = net * 455;
  const diamond = stoneAmount(0.284, 87500, 5);
  const rows = buildInvoiceLines(
    invoice({
      netWtGrams: net,
      goldAmount: gold,
      labourAmount: labour,
      stones: [{ stoneType: 'diamond', quality: '', carats: 0.284, amount: diamond, listRate: 87500 }],
      wastage: { grams, ratePerGram: 12531.7, percent: 5, amount: grams * 12531.7 },
      mrp: gold + labour + diamond + grams * 12531.7,
    }),
  );
  const figures = serverMath.computeInvoiceFigures({
    lineItems: toRequestItems(rows),
    gstRate: 3,
    intraState: true,
  });
  const line = (pattern) => figures.lines.find((entry) => pattern.test(entry.item.description));
  assert.equal(line(/^Wastage/).discountPaise, 0);
  assert.equal(line(/^Gold/).discountPaise, 0);
  assert.equal(line(/^Diamond/).discountPaise, 124200); // 24,850 − 23,608
});

test('invoice: other charges bill as priced into the MRP', () => {
  const base = invoice({ netWtGrams: 10, goldAmount: 93750, labourAmount: 5000 });

  // The piece's own named charge.
  const own = buildInvoiceLines({
    ...base,
    otherCharges: { items: [{ id: 'h', name: 'Hallmark', amount: 1500 }], remarks: '', total: 1500 },
    mrp: 100250,
  });
  assert.equal(sumLineAmounts(own), 100250);
  assert.ok(own.some((row) => row.description === 'Hallmark' && row.amount === 1500));

  // A list that does not match what was priced (another scan's, or edited
  // since): the priced figure bills, on one line.
  const priced = buildInvoiceLines({
    ...base,
    otherCharges: { items: [], remarks: '', total: 1500 },
    mrp: 100250,
  });
  assert.equal(sumLineAmounts(priced), 100250);
  assert.ok(priced.some((row) => row.description === 'Other Charges' && row.amount === 1500));

  // Charges that were not priced into the MRP are not billed.
  const foreign = buildInvoiceLines({
    ...base,
    otherCharges: { items: [{ id: 'x', name: 'Packing', amount: 800 }], remarks: '', total: 0 },
    mrp: 98750,
  });
  assert.equal(sumLineAmounts(foreign), 98750);
  assert.equal(foreign.some((row) => row.description === 'Packing'), false);
});

test('invoice: no labour, no wastage — no empty lines for them', () => {
  const rows = buildInvoiceLines(invoice({ netWtGrams: 10, goldAmount: 93750, mrp: 93750 }));
  assert.deepEqual(rows.map((row) => row.key), ['gold-base-metal']);
  assert.equal(rows[0].price, 9375);
  assert.equal(rows[0].amount, 93750);
});

test('totals: GST half-up to the paisa, grand total half-up to the rupee', () => {
  const igst = (amounts) => computeInvoiceTax(amounts, 3, false).gst;
  assert.equal(igst([98750]), 2962.5);
  assert.equal(computeGrandTotal(98750, 2962.5), 101713);
  assert.equal(igst([174123]), 5223.69);
  assert.equal(igst([50001]), 1500.03);
  assert.equal(computeGrandTotal(50001, 1500.03), 51501);
  assert.equal(igst([0]), 0);
  assert.equal(computeInvoiceTax([1000], 0, false).gst, 0);
});

test('totals: a Delhi supplier taxes each line, CGST and SGST each half-up', () => {
  // 99,000 + 1,083: CGST = SGST = 1,485.00 + 16.245 → 16.25 = 1,501.25.
  // Taxing the subtotal once gave 3,002.49 and ₹1,03,085 against the PDF's
  // ₹1,03,086.
  const tax = computeInvoiceTax([99000, 1083], 3, true);
  assert.deepEqual(tax, { cgst: 1501.25, sgst: 1501.25, igst: 0, gst: 3002.5 });
  assert.equal(computeGrandTotal(100083, tax.gst), 103086);
  // 50,001 + 3,015: ₹54,607, as the PDF prints (the app said ₹54,606).
  const second = computeInvoiceTax([50001, 3015], 3, true);
  assert.equal(second.gst, 1590.5);
  assert.equal(computeGrandTotal(53016, second.gst), 54607);
  // Outside Delhi the same lines carry IGST at the full rate.
  assert.deepEqual(computeInvoiceTax([50001, 3015], 3, false), {
    cgst: 0,
    sgst: 0,
    igst: 1590.48,
    gst: 1590.48,
  });

  assert.equal(isIntraStateSupplier('07AAACM1234A1Z5'), true);
  assert.equal(isIntraStateSupplier(' 07AAACM1234A1Z5'), true);
  assert.equal(isIntraStateSupplier('09AAACM1234A1Z5'), false);
  assert.equal(isIntraStateSupplier(''), false);
  assert.equal(isIntraStateSupplier(undefined), false);
});

test("totals: the app's GST and grand total are the server's", { skip: NO_SERVER }, () => {
  const rnd = seeded(7);
  for (let i = 0; i < 5000; i += 1) {
    const count = 2 + Math.floor(rnd() * 5);
    const amounts = Array.from({ length: count }, () => 1 + Math.floor(rnd() * 200000));
    const items = amounts.map((amount) => ({ description: 'Gold (in grams)', qty: 1, price: amount, amount }));
    const subtotal = amounts.reduce((sum, amount) => sum + amount, 0);
    for (const intraState of [true, false]) {
      const figures = serverMath.computeInvoiceFigures({ lineItems: items, gstRate: 3, intraState });
      const tax = computeInvoiceTax(amounts, 3, intraState);
      assert.equal(toPaise(tax.gst), figures.gstPaise, `${amounts} intra=${intraState}: GST`);
      assert.equal(toPaise(tax.cgst), figures.cgstPaise, `${amounts} intra=${intraState}: CGST`);
      assert.equal(toPaise(tax.igst), figures.igstPaise, `${amounts} intra=${intraState}: IGST`);
      assert.equal(toPaise(computeGrandTotal(subtotal, tax.gst)), figures.grandPaise, `${amounts}: grand total`);
    }
  }
});
