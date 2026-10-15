/**
 * Pins the money arithmetic (utils/moneyMath.ts):
 *
 *  - rounding is commercial half-up on the exact figure: a float that lands
 *    a hair under .50 (23607.499999999996 for 0.284 ct × ₹87,500 less 5%)
 *    still rounds up, as the decimal it stands for does;
 *  - the invoice is rounded once: its lines share out the MRP the card
 *    showed, rounded, so the subtotal is that MRP — wastage included, on its
 *    own line of grams at the 24K rate;
 *  - Qty × Price of every per-gram/per-carat line rounds to its Amount;
 *  - other charges bill as they were priced into the MRP, never another
 *    scan's list;
 *  - GST is half-up to the paisa and the grand total half-up to the rupee.
 *
 * The module has no imports, so node loads the app's own file directly
 * (type stripping, Node 22.18+ / 24) — no mirrored copy to drift.
 *
 * Run with:  node --test utils/__tests__/moneyMath.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allocateWholeRupees,
  buildInvoiceLines,
  computeGrandTotal,
  computeGstAmount,
  roundHalfUp,
  sumLineAmounts,
  toPaise,
} from '../moneyMath.ts';

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
  const gst = computeGstAmount(subtotal, 3);
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
        { stoneType: 'diamond', quality: 'FG VS', carats: 0.37, amount: diamond },
        { stoneType: 'colorstone', quality: '', carats: 1.25, amount: colorstone },
      ],
      mrp: gold + diamond + colorstone,
    }),
  );
  for (const row of rows) {
    assert.equal(roundHalfUp(row.qty * row.price), row.amount, row.key);
    assert.equal(roundHalfUp(row.price, 2), row.price, `${row.key} price is to the paisa`);
  }
  // The gold line prints the rate the card shows (24K rate × 75%), not the
  // amount divided back out.
  assert.equal(rows[0].price, 9398.78);
  // A discounted diamond prints its net rate (₹61,111 less 10%), so the line
  // closes: 0.37 × 54,999.90 = 20,349.96 → ₹20,350.
  assert.equal(rows[1].price, 54999.9);
  assert.equal(rows[1].amount, 20350);
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
  assert.equal(computeGstAmount(98750, 3), 2962.5);
  assert.equal(computeGrandTotal(98750, 2962.5), 101713);
  assert.equal(computeGstAmount(174123, 3), 5223.69);
  assert.equal(computeGstAmount(50001, 3), 1500.03);
  assert.equal(computeGrandTotal(50001, 1500.03), 51501);
  assert.equal(computeGstAmount(0, 3), 0);
  assert.equal(computeGstAmount(1000, 0), 0);
});
