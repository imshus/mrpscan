/**
 * The Estimated Invoice is the GST invoice's own lines, grouped: its rows add
 * up to the invoice subtotal, for one scan and for a cart, and the text and
 * the PDF carry exactly the figures the card shows.
 *
 * Run with:  node --test utils/__tests__/estimateBreakdown.test.mjs
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { estimateBreakdown, estimateText, estimateHtml, estimateRows } = await import(
  pathToFileURL(path.join(ROOT, 'utils', 'estimateBreakdown.ts')).href
);

const line = (key, amount) => ({ key, description: key, note: '', qty: 1, qtyUnit: '', price: amount, amount });

test('one scan: each line goes to its row, and the total is the invoice subtotal', () => {
  const rows = [
    line('gold-base-metal', 44438), line('stone-diamond-0', 10800), line('stone-colorstone-1', 200),
    line('labour-charge', 4480), line('wastage', 3881), line('other-charge-a', 300),
  ];
  const b = estimateBreakdown(rows);
  assert.deepEqual(b, { gold: 44438, diamond: 10800, colorstone: 200, labour: 4480, wastage: 3881, otherCharges: 300, total: 64099 });
  assert.equal(b.total, rows.reduce((s, r) => s + r.amount, 0));
});

test('a cart: lines of every piece are summed by kind', () => {
  const rows = [
    line('piece-0-gold-base-metal', 40000), line('piece-0-labour-charge', 4000),
    line('piece-1-gold-base-metal', 30000), line('piece-1-wastage', 2500), line('piece-1-labour-charge', 3000),
  ];
  const b = estimateBreakdown(rows);
  assert.equal(b.gold, 70000);
  assert.equal(b.labour, 7000);
  assert.equal(b.wastage, 2500);
  assert.equal(b.total, 79500);
});

test('the text and the PDF carry the card\'s rows and Final MRP', () => {
  const b = estimateBreakdown([line('gold-base-metal', 44438), line('labour-charge', 4480), line('wastage', 3881)]);
  assert.deepEqual(estimateRows(b).map((r) => r.label), ['Gold Amount', 'Labour Amount', 'Wastage Amount']);
  const text = estimateText(b, '22K Gold Chain · TAG-30145');
  assert.match(text, /Gold Amount: ₹44,438/);
  assert.match(text, /Final MRP: ₹52,799/);
  const html = estimateHtml(b, { title: '22K Gold Chain · TAG-30145', shopName: 'Garg Jewellers' });
  for (const v of ['₹44,438', '₹4,480', '₹3,881', '₹52,799', 'Garg Jewellers']) assert.ok(html.includes(v), v);
});
