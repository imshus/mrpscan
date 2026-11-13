/**
 * Pins Settings → History's plain logic (utils/historyFormat.ts): the
 * mockup's fmtWhen ("Today, 8:59 am", "Yesterday, 7:24 am", "15 Oct, 4:24
 * am") by calendar day, prices as "₹ 82,694" with Indian grouping and
 * half-up rounding, and the rows the three lists turn into — tag scans,
 * wishlist, and checkouts ("Cart · 2 items", or "Invoice <number>" for one
 * issued before the server counted pieces).
 *
 * The module has no imports, so node loads the app's own file directly
 * (type stripping, Node 22.18+ / 24) — no mirrored copy to drift. Dates are
 * built in local time, as the phone reads them.
 *
 * Run with:  node --test utils/__tests__/historyFormat.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkoutHistoryRow,
  formatHistoryPrice,
  formatHistoryWhen,
  groupIndianDigits,
  scanHistoryRow,
} from '../historyFormat.ts';

// 17 Oct 2026, 10:30 am local.
const NOW = new Date(2026, 9, 17, 10, 30);
const at = (day, hours, minutes, month = 9, year = 2026) => new Date(year, month, day, hours, minutes);

test('when: today and yesterday by calendar day, else day and month', () => {
  assert.equal(formatHistoryWhen(at(17, 8, 59), NOW), 'Today, 8:59 am');
  assert.equal(formatHistoryWhen(at(16, 7, 24), NOW), 'Yesterday, 7:24 am');
  assert.equal(formatHistoryWhen(at(15, 4, 24), NOW), '15 Oct, 4:24 am');
  // Last night at 11 is yesterday though it is under 24 hours ago.
  assert.equal(formatHistoryWhen(at(16, 23, 0), NOW), 'Yesterday, 11:00 pm');
  assert.equal(formatHistoryWhen(at(2, 9, 5, 0), NOW), '2 Jan, 9:05 am');
  // A month boundary is still yesterday.
  assert.equal(formatHistoryWhen(at(30, 18, 0, 8), new Date(2026, 9, 1, 9, 0)), 'Yesterday, 6:00 pm');
});

test('when: noon and midnight read as 12, minutes are two digits', () => {
  assert.equal(formatHistoryWhen(at(17, 0, 5), NOW), 'Today, 12:05 am');
  assert.equal(formatHistoryWhen(at(17, 12, 0), NOW), 'Today, 12:00 pm');
  assert.equal(formatHistoryWhen(at(17, 13, 7), NOW), 'Today, 1:07 pm');
});

test('when: ISO strings and epoch numbers are read; the future is today; junk is empty', () => {
  assert.equal(formatHistoryWhen(at(17, 8, 59).toISOString(), NOW), 'Today, 8:59 am');
  assert.equal(formatHistoryWhen(at(16, 7, 24).getTime(), NOW), 'Yesterday, 7:24 am');
  assert.equal(formatHistoryWhen(at(18, 9, 0), NOW), 'Today, 9:00 am');
  assert.equal(formatHistoryWhen('', NOW), '');
  assert.equal(formatHistoryWhen('not a date', NOW), '');
  assert.equal(formatHistoryWhen(null, NOW), '');
  assert.equal(formatHistoryWhen(undefined, NOW), '');
});

test('price: Indian grouping, half-up to the rupee', () => {
  assert.equal(groupIndianDigits('694'), '694');
  assert.equal(groupIndianDigits('82694'), '82,694');
  assert.equal(groupIndianDigits('114131'), '1,14,131');
  assert.equal(groupIndianDigits('12345678'), '1,23,45,678');
  assert.equal(formatHistoryPrice(82694), '₹ 82,694');
  assert.equal(formatHistoryPrice(114131), '₹ 1,14,131');
  assert.equal(formatHistoryPrice(0), '₹ 0');
  assert.equal(formatHistoryPrice(999.5), '₹ 1,000');
  // A float a hair under .50 still rounds up, as the price it stands for does.
  assert.equal(formatHistoryPrice(23607.499999999996), '₹ 23,608');
  assert.equal(formatHistoryPrice(23607.49), '₹ 23,607');
  assert.equal(formatHistoryPrice('82694'), '₹ 82,694');
  assert.equal(formatHistoryPrice(-1500), '₹ -1,500');
});

test('price: missing or unreadable is a dash', () => {
  assert.equal(formatHistoryPrice(undefined), '—');
  assert.equal(formatHistoryPrice(null), '—');
  assert.equal(formatHistoryPrice(''), '—');
  assert.equal(formatHistoryPrice('abc'), '—');
  assert.equal(formatHistoryPrice(Number.NaN), '—');
});

test('tag scan row: item, "TAG · when", price', () => {
  assert.deepEqual(
    scanHistoryRow(
      { scanId: 's1', itemName: '22K Gold Necklace', tagCode: 'TAG-10432', finalMRP: 82694, createdAt: at(17, 8, 59).toISOString() },
      NOW,
    ),
    { key: 's1', title: '22K Gold Necklace', sub: 'TAG-10432 · Today, 8:59 am', price: '₹ 82,694' },
  );
  // No tag code read: the time alone, no stray separator.
  assert.equal(
    scanHistoryRow({ scanId: 's2', itemName: '18K Diamond Jewellery', tagCode: '', finalMRP: 1, createdAt: at(16, 7, 24).toISOString() }, NOW).sub,
    'Yesterday, 7:24 am',
  );
  assert.equal(scanHistoryRow({ scanId: 's3', finalMRP: 10 }, NOW).title, 'Tag scan');
  assert.equal(scanHistoryRow(null, NOW), null);
  assert.equal(scanHistoryRow('x', NOW), null);
});

test('checkout row: pieces when counted, else the invoice number; when; grand total', () => {
  assert.deepEqual(
    checkoutHistoryRow(
      { _id: 'i1', invoiceNumber: 'INV-2026-1016-00001', pieceCount: 2, grandTotal: 114131, createdAt: at(16, 8, 24).toISOString() },
      NOW,
    ),
    { key: 'i1', title: 'Cart · 2 items', sub: 'Yesterday, 8:24 am', price: '₹ 1,14,131' },
  );
  assert.equal(checkoutHistoryRow({ _id: 'i2', pieceCount: 1, grandTotal: 5 }, NOW).title, 'Cart · 1 item');
  assert.equal(
    checkoutHistoryRow({ _id: 'i3', invoiceNumber: 'INV-2026-0627-00001', grandTotal: 5 }, NOW).title,
    'Invoice INV-2026-0627-00001',
  );
  assert.equal(checkoutHistoryRow({ _id: 'i4', invoiceNumber: 'INV-1', pieceCount: 0, grandTotal: 5 }, NOW).title, 'Invoice INV-1');
  assert.equal(checkoutHistoryRow({ _id: 'i5', grandTotal: 5 }, NOW).title, 'Invoice');
  assert.equal(checkoutHistoryRow(undefined, NOW), null);
});
