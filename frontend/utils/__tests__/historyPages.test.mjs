/**
 * Pins the rows of History's own pages (utils/historyFormat.ts, "History
 * pages"): Tag scan history from GET /history/scans — "TAG-10432 · Today,
 * 8:59 am", "—" for a tag read and never priced — Wishlist history from GET
 * /history/wishlist ("Added Today, 7:24 am"), Checkout history from GET
 * /history/checkouts ("Cart · 2 items", counted from the pieces when the
 * count is missing); what each row opens; and pages merged without a row
 * shown twice.
 *
 * historyFormat has no imports, so node loads the app's own file directly
 * (type stripping, Node 22.18+ / 24). Dates are built in local time.
 *
 * Run with:  node --test utils/__tests__/historyPages.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendHistoryPage,
  checkoutPageRow,
  roundRupees,
  scanPageRow,
  wishlistPageRow,
} from '../historyFormat.ts';

// 17 Oct 2026, 10:30 am local.
const NOW = new Date(2026, 9, 17, 10, 30);
const at = (day, hours, minutes) => new Date(2026, 9, day, hours, minutes).toISOString();

test('roundRupees: half-up to the rupee, a float a hair under .50 still up', () => {
  assert.equal(roundRupees(82694.4), 82694);
  assert.equal(roundRupees(82694.5), 82695);
  assert.equal(roundRupees(23607.499999999996), 23608);
  assert.equal(roundRupees(-1500.5), -1501);
});

test('scan row: item, "TAG · when", price; opens the scan id', () => {
  assert.deepEqual(
    scanPageRow(
      { id: 'h1', scanId: 's1', itemName: '22K Gold Necklace', tagCode: 'TAG-10432', finalMRP: 82694, status: 'priced', createdAt: at(17, 8, 59) },
      NOW,
    ),
    { key: 'h1', id: 's1', title: '22K Gold Necklace', sub: 'TAG-10432 · Today, 8:59 am', price: '₹ 82,694' },
  );
});

test('scan row: a tag read and never priced shows a dash for its price', () => {
  const row = scanPageRow(
    { id: 'h2', scanId: 's2', itemName: '18K Diamond Jewellery', tagCode: '', finalMRP: null, status: 'read', createdAt: at(16, 7, 24) },
    NOW,
  );
  assert.equal(row.price, '—');
  assert.equal(row.sub, 'Yesterday, 7:24 am');
  assert.equal(row.id, 's2');
});

test('scan row: no scan id, nothing to open; junk is no row', () => {
  const row = scanPageRow({ id: 'h3', finalMRP: 10 }, NOW);
  assert.equal(row.id, '');
  assert.equal(row.key, 'h3');
  assert.equal(row.title, 'Tag scan');
  assert.equal(scanPageRow(null, NOW), null);
  assert.equal(scanPageRow([], NOW), null);
});

test('wishlist row: name, "Added when", MRP; opens the entry id', () => {
  assert.deepEqual(
    wishlistPageRow({ id: 'w1', itemName: '22K Gold Ring', tagCode: 'TAG-1', mrp: 45210.5, createdAt: at(17, 7, 24) }, NOW),
    { key: 'w1', id: 'w1', title: '22K Gold Ring', sub: 'Added Today, 7:24 am', price: '₹ 45,211' },
  );
  const bare = wishlistPageRow({ id: 'w2' }, NOW);
  assert.equal(bare.title, 'Wishlist item');
  assert.equal(bare.sub, '');
  assert.equal(bare.price, '—');
  assert.equal(wishlistPageRow('x', NOW), null);
});

test('checkout row: "Cart · n items", when, grand total; opens the invoice id', () => {
  assert.deepEqual(
    checkoutPageRow(
      {
        id: 'i1',
        invoiceNumber: 'INV-2026-1016-00001',
        pieceCount: 2,
        pieces: [{ itemName: 'Ring', tagCode: 'T1', mrp: 1 }, { itemName: 'Chain', tagCode: 'T2', mrp: 2 }],
        grandTotal: 114131,
        createdAt: at(16, 8, 24),
      },
      NOW,
    ),
    { key: 'i1', id: 'i1', title: 'Cart · 2 items', sub: 'Yesterday, 8:24 am', price: '₹ 1,14,131' },
  );
  // No count: the pieces listed are counted.
  assert.equal(
    checkoutPageRow({ id: 'i2', pieces: [{ itemName: 'Ring' }], grandTotal: 5 }, NOW).title,
    'Cart · 1 item',
  );
  // Neither: the invoice number, as before.
  const numbered = checkoutPageRow({ id: 'i3', invoiceNumber: 'INV-9', grandTotal: 5 }, NOW);
  assert.equal(numbered.title, 'Invoice INV-9');
  assert.equal(numbered.id, 'i3');
  assert.equal(checkoutPageRow({ invoiceNumber: 'INV-10', grandTotal: 5 }, NOW).id, '');
  assert.equal(checkoutPageRow(undefined, NOW), null);
});

test('pages: every readable entry of a page, none shown twice', () => {
  const first = appendHistoryPage([], [{ id: 'w1' }, null, { id: 'w2' }], wishlistPageRow, NOW);
  assert.deepEqual(first.map((row) => row.key), ['w1', 'w2']);
  // An entry written meanwhile pushed w2 onto the next page: it stays once.
  const next = appendHistoryPage(first, [{ id: 'w2' }, { id: 'w3' }], wishlistPageRow, NOW);
  assert.deepEqual(next.map((row) => row.key), ['w1', 'w2', 'w3']);
  // More than one page's worth is all kept: nothing is capped.
  const many = Array.from({ length: 45 }, (_, i) => ({ id: `w${i}` }));
  assert.equal(appendHistoryPage([], many, wishlistPageRow, NOW).length, 45);
});
